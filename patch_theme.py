import re

with open('apps/user-interface/src/App.jsx', 'r') as f:
    content = f.read()

search = """  useEffect(() => {
    if (hydrated) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme, hydrated]);"""

replace = """  useEffect(() => {
    if (hydrated) {
      document.documentElement.setAttribute('data-theme', 'dark'); // Enforce dark theme
    }
  }, [hydrated]);"""

content = content.replace(search, replace)

with open('apps/user-interface/src/App.jsx', 'w') as f:
    f.write(content)

print("patched app")

with open('apps/user-interface/src/store/useStore.js', 'r') as f:
    content = f.read()

search2 = """      theme: 'dark', // 'dark' | 'light'"""

replace2 = """      theme: 'dark', // Always dark"""

content = content.replace(search2, replace2)

with open('apps/user-interface/src/store/useStore.js', 'w') as f:
    f.write(content)
print("patched store")
