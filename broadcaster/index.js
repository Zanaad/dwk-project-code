const { connect } = require("nats");
const axios = require("axios");

const NATS_URL =
  process.env.NATS_URL || "nats://my-nats.todo.svc.cluster.local:4222";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!DISCORD_WEBHOOK_URL) {
  console.log(
    "DISCORD_WEBHOOK_URL not set - broadcaster will only log messages",
  );
}

async function main() {
  try {
    console.log(`Connecting to NATS at ${NATS_URL}`);
    const nc = await connect({
      servers: [NATS_URL],
    });

    console.log("Connected to NATS");
    console.log(
      'Subscribing to "todo.created" and "todo.updated" subjects with queue group',
    );

    // Subscribe to todo created events with queue group
    const createdSub = nc.subscribe("todo.created", { queue: "broadcasters" });
    (async () => {
      for await (const msg of createdSub) {
        await handleTodoMessage(msg, "created");
      }
    })();

    // Subscribe to todo updated events with queue group
    const updatedSub = nc.subscribe("todo.updated", { queue: "broadcasters" });
    (async () => {
      for await (const msg of updatedSub) {
        await handleTodoMessage(msg, "updated");
      }
    })();

    console.log("Broadcaster ready and listening for messages");

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("Closing connection...");
      await nc.close();
      process.exit(0);
    });
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

async function handleTodoMessage(msg, action) {
  try {
    const data = JSON.parse(new TextDecoder().decode(msg.data));

    console.log(`Received todo.${action} event:`, data);

    // If no Discord webhook, just log and return
    if (!DISCORD_WEBHOOK_URL) {
      console.log(
        `[STAGING] Would send to Discord - Task: ${data.task || "N/A"}, Done: ${data.done}`,
      );
      return;
    }

    // Create Discord embed message
    const embed = {
      title: `Todo ${action === "created" ? "✅ Created" : "📝 Updated"}`,
      description: data.task || "N/A",
      color: action === "created" ? 65280 : 16776960, // Green for created, Yellow for updated
      fields: [
        {
          name: "Task",
          value: data.task || "N/A",
          inline: true,
        },
        {
          name: "Status",
          value: data.done ? "✅ Done" : "⏳ Pending",
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    // Send to Discord
    const response = await axios.post(DISCORD_WEBHOOK_URL, {
      embeds: [embed],
    });

    console.log(
      `✅ Message sent to Discord successfully (status: ${response.status})`,
    );
  } catch (err) {
    console.error(`Error handling todo.${action} event:`, err.message);
  }
}

main();
