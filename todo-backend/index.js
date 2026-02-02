const http = require("http");
const { Pool } = require("pg");
const { connect } = require("nats");

const port = process.env.PORT || 3000;
const NATS_URL =
  process.env.NATS_URL || "nats://my-nats.todo.svc.cluster.local:4222";

let nc = null;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "postgres-svc",
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || "todo",
  port: 5432,
});

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id BIGINT PRIMARY KEY,
        text TEXT NOT NULL,
        done BOOLEAN DEFAULT FALSE
      )
    `);
    console.log("Todos table initialized");
  } catch (err) {
    console.error("Failed to initialize database", err);
    process.exit(1);
  }
}

async function getTodos() {
  const result = await pool.query(
    "SELECT id, text, done FROM todos ORDER BY id ASC",
  );
  return result.rows;
}

async function setTodoDone(id) {
  const result = await pool.query(
    "UPDATE todos SET done = TRUE WHERE id = $1 RETURNING id, text, done",
    [id],
  );

  // Send NATS message if connected
  if (nc && result.rows[0]) {
    try {
      nc.publish(
        "todo.updated",
        JSON.stringify({
          id: result.rows[0].id,
          task: result.rows[0].text,
          done: true,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (err) {
      console.error("Failed to publish NATS message", err);
    }
  }
}

async function createTodo(id, text) {
  const result = await pool.query(
    "INSERT INTO todos (id, text) VALUES ($1, $2) RETURNING id, text",
    [id, text],
  );

  // Send NATS message if connected
  if (nc) {
    try {
      nc.publish(
        "todo.created",
        JSON.stringify({
          id: result.rows[0].id,
          task: result.rows[0].text,
          done: false,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (err) {
      console.error("Failed to publish NATS message", err);
    }
  }

  return result.rows[0];
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function logTodoAttempt(text, outcome, extra = {}) {
  const payload = {
    event: "todo-create",
    outcome,
    length: text.length,
    text,
    ...extra,
  };
  console.log(JSON.stringify(payload));
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        const json = body ? JSON.parse(body) : {};
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });

    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/healthz" && req.method === "GET") {
    // Liveness probe: simple health check
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  } else if (req.url === "/readyz" && req.method === "GET") {
    // Readiness probe: check if database is ready
    try {
      await pool.query("SELECT 1");
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Ready");
    } catch (err) {
      console.error(
        "Readiness check failed - database not ready:",
        err.message,
      );
      res.writeHead(503, { "Content-Type": "text/plain" });
      res.end("Not Ready - Database connection failed");
    }
    return;
  } else if (req.url === "/todos" && req.method === "GET") {
    try {
      const todos = await getTodos();
      return sendJson(res, 200, todos);
    } catch (err) {
      console.error("Failed to fetch todos", err);
      return sendJson(res, 500, { error: "Failed to fetch todos" });
    }
  }

  if (req.url === "/todos" && req.method === "POST") {
    try {
      const body = await parseRequestBody(req);
      const text = (body.text || "").trim();

      if (!text) {
        logTodoAttempt(text, "rejected", { reason: "text_required" });
        return sendJson(res, 400, { error: "text is required" });
      }

      if (text.length > 140) {
        logTodoAttempt(text, "rejected", { reason: "too_long" });
        return sendJson(res, 400, { error: "text must be 140 chars or less" });
      }

      const todo = await createTodo(Date.now(), text);
      logTodoAttempt(text, "created", { id: todo.id });
      return sendJson(res, 201, todo);
    } catch (err) {
      console.error("Failed to create todo", err);
      return sendJson(res, 400, { error: "invalid JSON" });
    }
  }

  // Mark todo as done
  if (req.url.startsWith("/todos/") && req.method === "PUT") {
    const id = req.url.split("/")[2];
    if (!id) {
      return sendJson(res, 400, { error: "Missing todo id" });
    }
    try {
      await setTodoDone(id);
      return sendJson(res, 200, { success: true });
    } catch (err) {
      console.error("Failed to mark todo as done", err);
      return sendJson(res, 500, { error: "Failed to update todo" });
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found\n");
  return;
});

async function start() {
  await initDatabase();

  // Connect to NATS
  try {
    nc = await connect({
      servers: [NATS_URL],
    });
    console.log(`Connected to NATS at ${NATS_URL}`);
  } catch (err) {
    console.warn(`Warning: Could not connect to NATS: ${err.message}`);
    // Continue anyway - NATS is optional for core functionality
  }

  server.listen(port, () => {
    console.log(`todo-backend listening on port ${port}`);
    console.log(`Connected to Postgres at ${process.env.POSTGRES_HOST}`);
  });
}

start();
