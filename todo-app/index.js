const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const port = process.env.PORT || 3000;
const IMAGE_DIR = process.env.IMAGE_DIR || "/var/lib/data";
const IMAGE_PATH = path.join(IMAGE_DIR, "cached-image.jpg");
const METADATA_PATH = path.join(IMAGE_DIR, "image-metadata.json");
const CACHE_DURATION_MS =
  parseInt(process.env.CACHE_DURATION_MS) || 10 * 60 * 1000;
const TODO_BACKEND_URL =
  process.env.TODO_BACKEND_URL || "http://todo-backend-svc:3000";
const IMAGE_URL = process.env.IMAGE_URL || "https://picsum.photos/1200";
const INDEX_PATH = path.join(__dirname, "public", "index.html");

// Ensure image directory exists
function ensureImageDir() {
  if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
  }
}

// Check if cached image is still valid
function isCacheValid() {
  if (!fs.existsSync(IMAGE_PATH) || !fs.existsSync(METADATA_PATH)) {
    return false;
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, "utf8"));
    const age = Date.now() - metadata.timestamp;
    return age < CACHE_DURATION_MS;
  } catch (err) {
    console.error("Failed to read metadata:", err);
    return false;
  }
}

// Fetch new image from Lorem Picsum (handles redirects)
function fetchNewImage(callback) {
  console.log("Fetching new image from Lorem Picsum...");

  const imageUrl = "https://picsum.photos/1200";

  function downloadImage(url) {
    https
      .get(url, (response) => {
        // Handle redirects (302, 301, etc.)
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          console.log(`Following redirect to ${response.headers.location}`);
          downloadImage(response.headers.location);
          return;
        }

        if (response.statusCode === 200) {
          const fileStream = fs.createWriteStream(IMAGE_PATH);

          response.pipe(fileStream);

          fileStream.on("finish", () => {
            fileStream.close();

            // Save metadata
            const metadata = { timestamp: Date.now() };
            fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata), "utf8");

            console.log("Image cached successfully");
            callback(null);
          });
        } else {
          callback(new Error(`Failed to fetch image: ${response.statusCode}`));
        }
      })
      .on("error", (err) => {
        callback(err);
      });
  }

  downloadImage(IMAGE_URL);
}

// Get image (from cache or fetch new)
function getImage(callback) {
  ensureImageDir();

  if (isCacheValid()) {
    console.log("Serving cached image");
    fs.readFile(IMAGE_PATH, callback);
  } else {
    fetchNewImage((err) => {
      if (err) {
        callback(err);
      } else {
        fs.readFile(IMAGE_PATH, callback);
      }
    });
  }
}

function proxyGetTodos(res) {
  const url = new URL("/todos", TODO_BACKEND_URL);

  http
    .get(url, (response) => {
      let data = "";

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", () => {
        res.writeHead(response.statusCode || 500, {
          "Content-Type":
            response.headers["content-type"] || "application/json",
        });
        res.end(data);
      });
    })
    .on("error", (err) => {
      console.error("Failed to fetch todos from backend", err);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to reach todo-backend" }));
    });
}

function proxyPostTodos(req, res) {
  const url = new URL("/todos", TODO_BACKEND_URL);

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", () => {
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body || ""),
      },
    };

    const backendReq = http.request(url, options, (backendRes) => {
      let data = "";

      backendRes.on("data", (chunk) => {
        data += chunk;
      });

      backendRes.on("end", () => {
        res.writeHead(backendRes.statusCode || 500, {
          "Content-Type":
            backendRes.headers["content-type"] || "application/json",
        });
        res.end(data);
      });
    });

    backendReq.on("error", (err) => {
      console.error("Failed to post todo to backend", err);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to reach todo-backend" }));
    });

    backendReq.write(body || "");
    backendReq.end();
  });

  req.on("error", (err) => {
    console.error("Failed to read request body", err);
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid request" }));
  });
}

function proxyPutTodo(req, res, id) {
  const url = new URL(`/todos/${id}`, TODO_BACKEND_URL);

  const backendReq = http.request(url, { method: "PUT" }, (backendRes) => {
    let data = "";

    backendRes.on("data", (chunk) => (data += chunk));
    backendRes.on("end", () => {
      res.writeHead(backendRes.statusCode || 500, {
        "Content-Type":
          backendRes.headers["content-type"] || "application/json",
      });
      res.end(data);
    });
  });

  backendReq.on("error", (err) => {
    console.error("Failed to mark todo as done", err);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to reach todo-backend" }));
  });

  backendReq.end();
}

const htmlContent = fs.readFileSync(INDEX_PATH, "utf8");

const server = http.createServer((req, res) => {
  if (req.url === "/healthz" && req.method === "GET") {
    // Liveness probe: simple health check
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
  } else if (req.url === "/readyz" && req.method === "GET") {
    // Readiness probe: check if backend is reachable
    return new Promise((resolve) => {
      const backendUrl = new URL(TODO_BACKEND_URL);
      http
        .get(
          {
            hostname: backendUrl.hostname,
            port: backendUrl.port || 80,
            path: "/todos",
            timeout: 2000,
          },
          (response) => {
            if (response.statusCode === 200) {
              res.writeHead(200, { "Content-Type": "text/plain" });
              res.end("Ready");
            } else {
              res.writeHead(503, { "Content-Type": "text/plain" });
              res.end("Not Ready - Backend not available");
            }
            resolve();
          },
        )
        .on("error", (err) => {
          console.error(
            "Readiness check failed - backend not reachable:",
            err.message,
          );
          res.writeHead(503, { "Content-Type": "text/plain" });
          res.end("Not Ready - Cannot reach backend");
          resolve();
        });
    });
  } else if (req.url === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(htmlContent);
  } else if (req.url === "/todos" && req.method === "GET") {
    proxyGetTodos(res);
  } else if (req.url === "/todos" && req.method === "POST") {
    proxyPostTodos(req, res);
  } else if (req.url.startsWith("/todos/") && req.method === "PUT") {
    const id = req.url.split("/")[2];
    proxyPutTodo(req, res, id);
  } else if (req.url === "/image" && req.method === "GET") {
    getImage((err, imageData) => {
      if (err) {
        console.error("Error serving image:", err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Failed to load image\n");
      } else {
        res.writeHead(200, { "Content-Type": "image/jpeg" });
        res.end(imageData);
      }
    });
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found\n");
  }
});

server.listen(port, () => {
  console.log(`Server started in port ${port}`);
});
