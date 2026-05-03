import re

with open('apps/server-bridge/auth/github.js', 'r') as f:
    content = f.read()

search = """  let cookieState = req.cookies?.github_oauth_state;
  if (!cookieState && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\\s*)github_oauth_state=([^;]*)/);
    if (match) cookieState = match[1];
  }"""

replace = """  const match = req.headers.cookie?.match(/(?:^|;\\s*)github_oauth_state=([^;]*)/);
  const cookieState = match ? match[1] : null;"""

content = content.replace(search, replace)

with open('apps/server-bridge/auth/github.js', 'w') as f:
    f.write(content)


with open('apps/server-bridge/auth/google.js', 'r') as f:
    content_g = f.read()

search_g = """  let cookieState = req.cookies?.google_oauth_state;
  if (!cookieState && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\\s*)google_oauth_state=([^;]*)/);
    if (match) cookieState = match[1];
  }"""

replace_g = """  const match = req.headers.cookie?.match(/(?:^|;\\s*)google_oauth_state=([^;]*)/);
  const cookieState = match ? match[1] : null;"""

content_g = content_g.replace(search_g, replace_g)

with open('apps/server-bridge/auth/google.js', 'w') as f:
    f.write(content_g)

print("fixed oauth state regex back to original")
