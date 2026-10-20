#!/usr/bin/env python3
"""Simulate openlmis/nginx routing to check that /v2 and the existing routes do not capture each other.

Usage: check-routes.py <keys.json> <routes.txt> [prefix]

keys.json  - output of GET /v1/kv/resources/?keys (a JSON list of "resources/..." keys)
routes.txt - the new UI's route paths, one per line, e.g. from
             grep -oE "fullPath: '[^']+'" src/route-tree.gen.ts | sed "s/fullPath: '//;s/'//"
prefix     - the UI prefix, default v2

The consul-template config emits regex locations in four passes (plain keys, {param} keys,
<all> keys, then the global <all>), each pass in key order, and nginx takes the first regex
that matches. The regexes are unanchored at the start, so a key like auth/<all> also matches
/v2/auth/x. Our own two keys may already exist (an update). Exit code 1 when anything collides.
Needs Python 3.9 or later.
"""

import json
import re
import sys

PARAM = re.compile(r"{[\w-]+}")
ALL = re.compile(r"<[\w-]+>")
GLOBAL = re.compile(r"^<[\w-]+>$")


def locations(keys):
    keys = sorted(k for k in keys if k)
    plain = [k for k in keys if not PARAM.search(k) and not ALL.search(k)]
    param = [k for k in keys if PARAM.search(k)]
    alls = [k for k in keys if ALL.search(k) and not GLOBAL.match(k)]
    result = [(k, "/" + k + "/?$") for k in plain]
    result += [(k, "/" + PARAM.sub(r"[\\w-]+", k) + "/?$") for k in param]
    result += [(k, "/" + ALL.sub(".+", k) + "/?$") for k in alls]
    if any(GLOBAL.match(k) for k in keys):
        result.append(("<all>", "/"))
    return result


def first_match(table, path):
    for key, regex in table:
        if re.search(regex, path):
            return key
    return None


def sample(key):
    path = "/" + PARAM.sub("abc-123", key)
    return ALL.sub("x/y", path)


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    prefix = sys.argv[3] if len(sys.argv) > 3 else "v2"
    existing = [k.removeprefix("resources/") for k in json.load(open(sys.argv[1]))]
    ours = {prefix, f"{prefix}/<all>"}
    if any((k == prefix or k.startswith(prefix + "/")) and k not in ours for k in existing):
        print(f"Something else already uses /{prefix}; stop and report.")
        return 1
    existing = [k for k in existing if k not in ours]
    table = locations(existing + sorted(ours))

    paths = [f"/{prefix}/", f"/{prefix}", f"/{prefix}/sw.js", f"/{prefix}/config.json",
             f"/{prefix}/locales/en.json", f"/{prefix}/assets/index-abc.js"]
    for line in open(sys.argv[2]):
        route = line.strip()
        if route and route != "/":
            paths.append(f"/{prefix}" + re.sub(r"\$\w+", "abc-123", route))

    stolen = {p: k for p in paths if (k := first_match(table, p)) not in ours}
    captured = {}
    for key in existing:
        if key and not GLOBAL.match(key):
            path = sample(key)
            if first_match(table, path) in ours:
                captured[path] = key

    print(f"{len(paths)} UI paths and {len(existing)} existing keys checked")
    for path, key in sorted(stolen.items()):
        print(f"  UI path {path} goes to existing key {key!r}")
    for path, key in sorted(captured.items()):
        print(f"  existing key {key!r} ({path}) would go to the new UI")
    return 1 if stolen or captured else 0


if __name__ == "__main__":
    sys.exit(main())
