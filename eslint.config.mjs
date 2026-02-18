import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'src-tauri/target/**'],
  },
  ...nextVitals,
  ...nextTypescript,
]

export default config
