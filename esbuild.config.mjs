import { build, context } from 'esbuild';

const isWatch = process.argv.includes('--watch');

const config = {
  entryPoints: ['src/sidepanel.js', 'src/background.js', 'src/content.js'],
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
  console.log('✅ Build complete → dist/');
}
