import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const distDir = join(root, 'dist')
const docsDir = join(root, 'docs')

rmSync(docsDir, { recursive: true, force: true })
mkdirSync(docsDir, { recursive: true })
cpSync(distDir, docsDir, { recursive: true })
writeFileSync(join(docsDir, '.nojekyll'), '')

console.log('Synced dist/ -> docs/ (with .nojekyll)')
