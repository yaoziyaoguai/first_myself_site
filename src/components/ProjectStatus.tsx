export function projectLifecycle(period: string) {
  return period.match(/持续维护|活跃开发|阶段性归档|阶段性实践/)?.[0];
}

export function ProjectStatus({ period }: { period: string }) {
  const status = projectLifecycle(period);
  if (!status) return null;
  const active = status === "持续维护" || status === "活跃开发";

  return (
    <span className="project-status" data-active={active} title={status}>
      {active ? "Active" : status === "阶段性归档" ? "Archived" : status}
    </span>
  );
}
