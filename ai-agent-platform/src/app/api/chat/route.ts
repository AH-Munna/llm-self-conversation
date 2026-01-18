import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { db } from "~/server/db";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const nvidia = createOpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY ?? "",
});

export async function POST(req: Request) {
  const { roomId, nextSpeakerId } = await req.json();

  // 1. Fetch Room, Participants, and Message History
  const room = await db.room.findUnique({
    where: { id: roomId },
    include: {
      participants: {
        include: { identity: true },
        orderBy: { joinedAt: "asc" }, // Deterministic order
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { identity: true },
      },
    },
  });

  if (!room) {
    return new Response("Room not found", { status: 404 });
  }

  // 2. Identify Current Speaker and Others
  const currentSpeaker = room.participants.find(
    (p) => p.identityId === nextSpeakerId
  )?.identity;

  if (!currentSpeaker) {
    return new Response("Speaker not found in room", { status: 400 });
  }

  const otherParticipants = room.participants
    .filter((p) => p.identityId !== nextSpeakerId)
    .map((p) => p.identity);

  // 3. Construct System Prompts (SillyTavern Style)
  // Logic: "You are {{char1}}..."
  let systemPrompt = room.scenario; // The "Main Prompt"

  // Replace {{char1}} with current speaker name
  systemPrompt = systemPrompt.replaceAll("{{char1}}", currentSpeaker.name);

  // Replace {{char2}}...{{charN}}
  otherParticipants.forEach((other, index) => {
    // {{char2}} corresponds to index 0, {{char3}} to index 1...
    // Adjust logic as needed. User said "dynamically add".
    // For now, simpler replacement if placeholders exist.
    systemPrompt = systemPrompt.replaceAll(`{{char${index + 2}}}`, other.name);
  });

  // Append User's Bio
  const fullSystemPrompt = `${systemPrompt}\n\nYour Character Definition:\n${currentSpeaker.bio}`;

  // 4. Construct Message History
  // Map DB messages to Vercel AI SDK format
  const coreMessages = room.messages.map((msg) => {
    if (msg.identityId === nextSpeakerId) {
      // It was said by the current speaker (Assistant role)
      return {
        role: "assistant",
        content: msg.content,
      } as const;
    } else {
      // It was said by someone else (User role from perspective of speaker)
      const senderName = msg.identity?.name ?? "User";
      return {
        role: "user",
        // Prefix with name
        content: `${senderName}: ${msg.content}`,
      } as const;
    }
  });

  // Prepend System Message
  const messages = [
    { role: "system", content: fullSystemPrompt } as const,
    ...coreMessages,
  ];

  // 5. Stream from NVIDIA NIM
  // Default to DeepSeek if not specified
  const modelName = "deepseek-ai/deepseek-v3.1-terminus";

  const result = await streamText({
    model: nvidia(modelName),
    messages,
    temperature: 0.7,
    // extraHeaders/body to enable "thinking" if needed (provider dependent)
    // Note: Vercel AI SDK abstract this, but extra body params might need 'providerOptions' 
    // or custom fetch implementation if not supported natively.
    async onFinish({ text }) {
      // Save the response to DB
        // We use 'await' here inside onFinish which is allowed but connection might close.
        // Best practice is to use `waitUntil` if on Cloudflare, or just await.
        // T3/Next serverless might terminate.
        try {
            await db.message.create({
                data: {
                    content: text,
                    role: "assistant", // It is an assistant response
                    roomId: roomId,
                    identityId: nextSpeakerId,
                    isUser: false
                }
            });
        } catch (e) {
            console.error("Failed to save message", e);
        }
    },
  });

  return result.toDataStreamResponse();
}
