# dependencies - update packages

Check package versions for known vulnerabilities. Update vulnerable packages.

Verify the application works.

If it's quick, update all packages to the latest versions. If updating all packages isn't feasible, update only vulnerable ones.

When changing major versions, check for breaking changes and review code that uses them.

for package.json: run `npm audit fix --force`, verify the application works. First update dependencies, then devDependencies. If all packages couldn't be updated, update only vulnerable ones. When changing major versions, check for breaking changes and review code that uses them.
