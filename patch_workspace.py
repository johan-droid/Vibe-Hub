import re

with open('apps/user-interface/src/pages/Workspace.jsx', 'r') as f:
    content = f.read()

# Add ShieldAlert import
search_imports = "from 'lucide-react';"
replace_imports = "from 'lucide-react';\nimport { ShieldAlert } from 'lucide-react';"
if 'ShieldAlert' not in content:
    content = content.replace("from 'lucide-react';", "ShieldAlert, from 'lucide-react';") # Not reliable with regex

    # Let's just do a simpler replace for imports
    import_match = re.search(r"import \{([^}]+)\} from 'lucide-react';", content)
    if import_match:
        old_imports = import_match.group(1)
        if 'ShieldAlert' not in old_imports:
            new_imports = old_imports + ", ShieldAlert"
            content = content.replace(import_match.group(0), f"import {{{new_imports}}} from 'lucide-react';")

# Add SecurityAudit import
if 'SecurityAudit' not in content:
    content = content.replace("const IntelligenceDashboard = React.lazy(() => import('../features/swarm/components/Dashboard'));",
                             "const IntelligenceDashboard = React.lazy(() => import('../features/swarm/components/Dashboard'));\nconst SecurityAudit = React.lazy(() => import('../features/security/components/SecurityAudit'));")

# Add NavIcon
nav_icon_search = """            <NavIcon
              icon={SearchIcon}
              active={sidebarMode === 'search'}
              onClick={() => { setSidebarMode('search'); setSidebarCollapsed(false); }}
            />"""
nav_icon_replace = """            <NavIcon
              icon={SearchIcon}
              active={sidebarMode === 'search'}
              onClick={() => { setSidebarMode('search'); setSidebarCollapsed(false); }}
            />
            <NavIcon
              icon={ShieldAlert}
              active={sidebarMode === 'security'}
              onClick={() => { setSidebarMode('security'); setSidebarCollapsed(false); }}
            />"""
content = content.replace(nav_icon_search, nav_icon_replace)

# Add SecurityAudit to conditional render
render_search = """                    {sidebarMode === 'search' && (
                      <div className="p-8 flex flex-col items-center justify-center h-full opacity-20 gap-4">
                        <SearchIcon size={32} />
                        <span className="label-small font-bold uppercase tracking-widest">Global_Search_Pending</span>
                      </div>
                    )}"""
render_replace = """                    {sidebarMode === 'search' && (
                      <div className="p-8 flex flex-col items-center justify-center h-full opacity-20 gap-4">
                        <SearchIcon size={32} />
                        <span className="label-small font-bold uppercase tracking-widest">Global_Search_Pending</span>
                      </div>
                    )}
                    {sidebarMode === 'security' && <SecurityAudit />}"""
content = content.replace(render_search, render_replace)


with open('apps/user-interface/src/pages/Workspace.jsx', 'w') as f:
    f.write(content)

print("patched workspace")
