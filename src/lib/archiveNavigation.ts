let archiveReturn: { pathname: string; search: string } | undefined;

export function updateArchiveQuery(update: (params: URLSearchParams) => void) {
  const url = new URL(window.location.href);
  update(url.searchParams);
  window.history.replaceState(null, "", url);
}

export function rememberArchiveLocation(pathname: string) {
  archiveReturn = { pathname, search: window.location.search };
  history.replaceState({ ...history.state, articleArchiveScrollY: window.scrollY }, "");
}

export function discardArchiveReturnOutside(pathname: string) {
  if (archiveReturn?.pathname !== pathname) archiveReturn = undefined;
}

export function consumeArchiveReturn(pathname: string) {
  const openedFrom = archiveReturn;
  archiveReturn = undefined;
  if (openedFrom?.pathname === pathname) {
    history.replaceState({ ...history.state, articleArchiveReturn: openedFrom }, "");
  }
}

export function archiveReturnSearch(pathname: string) {
  const openedFrom: typeof archiveReturn = history.state?.articleArchiveReturn;
  if (openedFrom?.pathname === pathname) return openedFrom.search;
}
