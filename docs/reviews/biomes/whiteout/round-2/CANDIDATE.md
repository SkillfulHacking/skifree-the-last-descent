# Round-2 candidate

**Frozen SHA:** `b70a793` (branch `pass5-whiteout`). Every commit after it on the branch adds evidence and documents only (`git diff b70a793 <later> -- src` is empty).

**Round 1 was:** `3f7bc45`. `git diff 3f7bc45 b70a793 -- src` shows every source change since.

**Gitar:** approved on the round-2 code. Its one finding (the Yeti forced visible at run start) was fixed in `7727328`; the regression check fails on the old code and passes on the fix.
