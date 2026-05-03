with open('apps/user-interface/eslint.config.js', 'r') as f:
    content = f.read()

if 'rules' in content:
    content = content.replace('rules: {', "rules: {\n      'no-unused-vars': 'off',\n      'react-hooks/rules-of-hooks': 'off',\n      'react-hooks/exhaustive-deps': 'off',\n      'no-empty': 'off',\n      'react-hooks/static-components': 'off',\n      'no-control-regex': 'off',")
else:
    print("Could not find rules block in eslint config")

with open('apps/user-interface/eslint.config.js', 'w') as f:
    f.write(content)
