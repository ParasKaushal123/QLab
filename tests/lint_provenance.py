#!/usr/bin/env python3
"""Lint provenance: ensure no SDK name in result contexts without provenanceBadge."""
import glob
import os
import re
import sys

SDK_NAMES = ['Qiskit', 'Cirq', 'PennyLane', 'qBraid', 'IBM']
ALLOWED_FILES = {
    'code.js',          # Codegen & syntax definitions
    'course.js',        # Educational text
    'course-ch2.js',    # Educational text
    'algos.js',         # Algorithm descriptions
    'templates.js',     # Template names
    'runner.js',        # The runner client
    'backends.js',      # Backend definitions & dispatch
    'icons-data.js',    # Icons
}

web_dir = os.path.join(os.path.dirname(__file__), '../apps/web')
files = glob.glob(os.path.join(web_dir, '*.js'))

violations = []
for f in files:
    base = os.path.basename(f)
    if base in ALLOWED_FILES:
        continue
    with open(f, 'r', encoding='utf-8') as fp:
        lines = fp.readlines()
    for idx, line in enumerate(lines, 1):
        # Skip pure comments
        sline = line.strip()
        if sline.startswith('//') or sline.startswith('/*') or sline.startswith('*'):
            continue
        # Check if line mentions an SDK in a result or display label without provenance
        for sdk in SDK_NAMES:
            if sdk in line:
                # Check surrounding context
                context = ''.join(lines[max(0, idx - 5):min(len(lines), idx + 5)])
                if 'provenance' not in context.lower() and 'sdk' not in context.lower() and 'badge' not in context.lower():
                    violations.append(f"{base}:{idx}: mentions '{sdk}' without provenance context:\n  {sline[:80]}")

print(f"Scanned {len(files)} files.")
if violations:
    print(f"Found {len(violations)} warnings/potential honesty issues:")
    for v in violations[:15]:
        print(f"  - {v}")
    if len(violations) > 15:
        print(f"  ... and {len(violations) - 15} more.")
else:
    print("✅ Provenance lint passed: zero honesty violations found!")
