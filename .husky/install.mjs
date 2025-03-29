// Skip Husky setup in production and CI environments
console.log('Checking environment for Husky setup...');

if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
  console.log('🔶 Skipping Husky setup in CI/production environment');
  process.exit(0);
}

console.log('🔷 Executing Husky git hooks setup...');
try {
  const husky = (await import('husky')).default;
  console.log(husky());
  console.log('✅ Husky setup completed successfully!');
} catch (error) {
  console.log('⚠️ Husky setup warning:', error.message);
  // Don't fail the build, just warn
  process.exit(0);
}
