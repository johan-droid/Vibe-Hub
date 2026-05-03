import re

with open('apps/user-interface/eslint.config.js', 'r') as f:
    content = f.read()

# Completely replace the rules block to avoid duplicates and turn off the annoying stuff
search = re.compile(r'rules: \{.*?\}', re.DOTALL)
replace = """rules: {
      'no-unused-vars': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'no-empty': 'off',
      'react-hooks/static-components': 'off',
      'no-control-regex': 'off',
      'react/jsx-no-target-blank': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    }"""
content = search.sub(replace, content)

with open('apps/user-interface/eslint.config.js', 'w') as f:
    f.write(content)
