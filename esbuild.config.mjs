import { build, context } from 'esbuild';

const isWatch = process.argv.includes('--watch');

const entryPoints = ['src/popup.js', 'src/background.js'];

const config = {
  entryPoints,
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  target: 'chrome120',
  minify: !isWatch,
  sourcemap: isWatch,
};

if (isWatch) {
  const ctx = await context(config);
  await ctx.watch();
  console.log('👀 Watching for changes...');
} else {
  await build(config);
  console.log('✅ Build complete → dist/popup.js, dist/background.js');
}
