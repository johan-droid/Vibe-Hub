import re

with open('apps/user-interface/src/pages/Workspace.jsx', 'r') as f:
    content = f.read()

# Fix setSidebarCollapsed undefined error
search_destructure = """    sidebarCollapsed,
    chatCollapsed,
    activeTab,
    activeFileContent, activeFilePath,
  } = useStore();"""

replace_destructure = """    sidebarCollapsed,
    setSidebarCollapsed,
    chatCollapsed,
    activeTab,
    activeFileContent, activeFilePath,
  } = useStore();"""
content = content.replace(search_destructure, replace_destructure)

# Fix conditional hook calling error by moving the auth check AFTER the hooks
search_auth_check = """  const { sendPrompt } = useAgent();

  if (!user && !localStorage.getItem('selina_token')) {
    return <Navigate to="/" replace />;
  }

  const onSidebarDrag = useCallback((delta) => {"""

replace_auth_check = """  const { sendPrompt } = useAgent();

  const onSidebarDrag = useCallback((delta) => {"""

content = content.replace(search_auth_check, replace_auth_check)

search_auth_check2 = """  const onTerminalDrag = useCallback((delta) => {
    setTerminalH((h) => Math.max(MIN_TERM_H, Math.min(MAX_TERM_H, h - delta)));
  }, []);"""

replace_auth_check2 = """  const onTerminalDrag = useCallback((delta) => {
    setTerminalH((h) => Math.max(MIN_TERM_H, Math.min(MAX_TERM_H, h - delta)));
  }, []);

  if (!user && !localStorage.getItem('selina_token')) {
    return <Navigate to="/" replace />;
  }"""

content = content.replace(search_auth_check2, replace_auth_check2)

with open('apps/user-interface/src/pages/Workspace.jsx', 'w') as f:
    f.write(content)

print("patched workspace2")
