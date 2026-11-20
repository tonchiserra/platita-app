#!/bin/sh
# Runs every scripts/*.test.ts with tsx and fails if any of them does.
status=0
for f in scripts/*.test.ts; do
  if npx tsx "$f" > /dev/null 2>&1; then echo "ok    $f"; else echo "FAIL  $f"; status=1; fi
done
exit $status
