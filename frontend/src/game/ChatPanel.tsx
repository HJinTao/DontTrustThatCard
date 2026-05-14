import { useState, type FormEvent } from "react";

import type { ChatMessage } from "@dont-trust-that-card/shared";

import { dispatchAudioEvent } from "../lib/audioEvents";

type ChatPanelProps = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
};

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) {
      return;
    }

    onSend(text);
    setDraft("");
  };

  return (
    <section className="panel chat-panel">
      <header className="panel-header">
        <span>房间电报</span>
      </header>
      <div className="chat-log">
        {messages.length === 0 ? <p className="muted">暂无消息</p> : null}
        {messages.map((message) => (
          <article key={message.id} className={`chat-message chat-${message.kind}`}>
            <strong>{message.displayName ?? "系统"}</strong>
            <span>{message.text}</span>
          </article>
        ))}
      </div>
      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          aria-label="聊天输入"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="输入房间消息"
        />
        <button
          type="submit"
          className="pixel-button secondary"
          onMouseEnter={() => dispatchAudioEvent("button-hover", { id: "chat-send" })}
        >
          发送
        </button>
      </form>
    </section>
  );
}
