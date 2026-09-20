"use client";

import React, { useEffect, useState } from "react";
import { RelationshipField, useField, useFormFields, useDocumentInfo } from "@payloadcms/ui";
import type { RelationshipFieldClientComponent } from "payload";
import "./styles.css";

type ArticleOption = { id: string | number; title: string; status: string; visibility: string };

export const SeriesArticlesField: RelationshipFieldClientComponent = (props) => {
  const { value, setValue, disabled } = useField<(string | number)[]>({ path: props.path });
  const { id } = useDocumentInfo();
  const status = useFormFields(([fields]) => fields.status?.value);
  const slug = useFormFields(([fields]) => fields.slug?.value);
  const [loaded, setLoaded] = useState<{ key: string; articles: ArticleOption[] } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const ids = Array.isArray(value) ? value : [];
  const key = ids.map(String).sort().join(",");
  const readOnly = disabled || props.readOnly;

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const query = new URLSearchParams({
      "where[id][in]": key, limit: "100", depth: "0",
      "select[title]": "true", "select[status]": "true", "select[visibility]": "true",
    });
    fetch(`/api/blog?${query}`, { signal: controller.signal, credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("无法读取文章状态，请重试。");
        return response.json();
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        setLoaded({ key, articles: result.docs });
        setError("");
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "读取失败，请重试。");
      });
    return () => controller.abort();
  }, [key, attempt]);

  const articles = key && loaded?.key === key ? loaded.articles : [];
  const publicCount = articles.filter((article) => article.status === "published" && article.visibility === "public").length;
  const move = (index: number, direction: number) => {
    const reordered = [...ids];
    [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
    setValue(reordered);
  };

  return (
    <div className="series-editor">
      <RelationshipField {...props} />
      {ids.length === 0 ? (
        <div className="series-editor__notice">还没有文章。从上方搜索框选入第一篇，保存后即可组成合集。</div>
      ) : error ? (
        <p role="alert">{error} <button className="series-editor__retry" type="button" onClick={() => setAttempt((current) => current + 1)}>重试</button></p>
      ) : loaded?.key !== key ? (
        <p role="status">正在读取所选文章…</p>
      ) : (
        <>
          <div className="series-editor__summary" aria-live="polite">
            <strong>阅读顺序 · {ids.length} 篇</strong>
            <span>用上移、下移调整，保存后生效</span>
          </div>
          <ol className="series-editor__list">
            {ids.map((articleId, index) => {
              const article = articles.find((item) => String(item.id) === String(articleId));
              const title = article?.title ?? "文章已不可用，请移除后重新选择";
              const visible = article?.status === "published" && article.visibility === "public";
              return (
                <li key={articleId}>
                  <span className="series-editor__number">{index + 1}</span>
                  <div className="series-editor__article">
                    <strong>{title}</strong>
                    <small>{visible ? "已发布 · 访客可见" : article?.status === "draft" ? "草稿 · 访客不可见" : "非公开 · 访客不可见"}</small>
                  </div>
                  <div className="series-editor__actions">
                    <button type="button" disabled={readOnly || index === 0} aria-label={`上移：${title}`} onClick={() => move(index, -1)}>↑ 上移</button>
                    <button type="button" disabled={readOnly || index === ids.length - 1} aria-label={`下移：${title}`} onClick={() => move(index, 1)}>↓ 下移</button>
                    <button type="button" disabled={readOnly} aria-label={`移除：${title}`} onClick={() => setValue(ids.filter((item) => item !== articleId))}>移除</button>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="series-editor__notice" aria-live="polite">
            {status !== "published"
              ? "当前为草稿，访客看不到合集。准备好后，将下方「前台展示」改为「展示合集」并保存。"
              : publicCount === 0
                ? "所选文章暂时都不对访客公开。至少有 1 篇已发布且公开的文章，合集才会出现在文章页。"
                : `保存后，文章页会展示这个合集，其中 ${publicCount} 篇文章对访客可见。${publicCount < ids.length ? "其余文章保持原有状态，不会自动发布。" : ""}`}
          </p>
        </>
      )}
      {id && status === "published" && typeof slug === "string" ? (
        <a className="series-editor__preview" href={`/blog/series/${encodeURIComponent(slug)}`} target="_blank" rel="noreferrer">查看已保存的合集 ↗</a>
      ) : null}
    </div>
  );
};
