export function projectLifecycle(period: string) {
  return period.match(/持续维护|活跃开发|阶段性归档|阶段性实践/)?.[0];
}

export function ProjectStatus({ period }: { period: string }) {
  const status = projectLifecycle(period);
  if (!status) return null;

  return (
    <span className="project-status" data-active={status === "持续维护" || status === "活跃开发"}>
      {status}
    </span>
  );
}
