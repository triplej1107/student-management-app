"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Notice } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { updateNoticeFieldAction, deleteNoticeAction } from "@/app/admin/students/notices/actions";

export function NoticeEditorRow({ notice }: { notice: Notice }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState(notice.title);
  const [date, setDate] = useState(notice.notice_date);
  const [tag, setTag] = useState(notice.tag);
  const [content, setContent] = useState(notice.content);

  function commit(field: "title" | "notice_date" | "tag" | "content", value: string) {
    startTransition(async () => {
      await updateNoticeFieldAction(notice.id, field, value);
      showToast("저장됨");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteNoticeAction(notice.id);
      showToast("공지 삭제됨");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-line-soft bg-white p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={(e) => commit("title", e.target.value)}
        placeholder="공지 제목"
        className="mb-1.5 w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px] font-bold"
      />
      <div className="mb-1.5 flex gap-1.5">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onBlur={(e) => commit("notice_date", e.target.value)}
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          onBlur={(e) => commit("tag", e.target.value)}
          placeholder="태그"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <button
          onClick={remove}
          className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-xs font-bold text-danger shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
        >
          삭제
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={(e) => commit("content", e.target.value)}
        placeholder="내용 (예: 숙제 공지 등)"
        className="min-h-[52px] w-full box-border rounded-lg border border-line px-2.5 py-2 text-xs"
      />
    </div>
  );
}
