"use client";

import { useRef, useState, type ComponentPropsWithoutRef } from "react";
import { Maximize2, X } from "lucide-react";

export function ArticleImage({ src, alt, ...image }: ComponentPropsWithoutRef<"img">) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const label = alt ? `查看大图：${alt}` : "查看大图";

  return (
    <>
      <button
        type="button"
        className="article-image-trigger"
        aria-label={label}
        aria-haspopup="dialog"
        ref={trigger}
        onClick={() => {
          dialog.current!.showModal();
          setOpen(true);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 保留 Markdown 图片的原始尺寸及外部来源。 */}
        <img {...image} src={src} alt={alt ?? ""} />
        <Maximize2 className="article-image-expand" size={18} aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        className="article-image-dialog"
        aria-label={label}
        onClose={() => {
          setOpen(false);
          setZoomed(false);
          trigger.current!.focus();
        }}
      >
        <div className="article-image-tools">
          <button className="text-link" type="button" onClick={() => setZoomed(!zoomed)}>
            {zoomed ? "适合屏幕" : "放大图片"}
          </button>
          <button className="article-image-close" type="button" aria-label="关闭大图" onClick={() => dialog.current!.close()}>
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <div className="article-image-viewport" data-zoomed={zoomed}>
          {open ? (
            // eslint-disable-next-line @next/next/no-img-element -- 大图使用文章提供的原始图片。
            <img src={src} alt={alt ?? ""} draggable={false} />
          ) : null}
        </div>
      </dialog>
    </>
  );
}
