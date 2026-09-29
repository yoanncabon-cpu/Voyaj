import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAPTER_COUNT, chapterProgress, journeyChapter, timelinePosition } from "../components/journey-model";

test("scroll position supports forward/backward travel and exact page boundaries", () => {
  assert.deepEqual(timelinePosition(-1), { progress: 0, chapter: 0, fraction: 0 });
  assert.deepEqual(timelinePosition(1), { progress: 1, chapter: 5, fraction: 1 });
  assert.equal(timelinePosition(2).chapter, 5);
  assert.equal(timelinePosition(NaN).chapter, 0);
  for (let chapter = 0; chapter < CHAPTER_COUNT; chapter++) {
    assert.equal(timelinePosition(chapterProgress(chapter)).chapter, chapter);
  }
  assert.equal(timelinePosition(.8).chapter, 4);
  assert.equal(timelinePosition(.2).chapter, 1);
});

test("changing perspective preserves a solidary choice and its price", () => {
  for (const perspective of ["driver", "passenger"] as const) {
    for (const chapter of [2, 3, 4, 5]) {
      assert.equal(journeyChapter(chapter, perspective, "gift").price, "0 €");
      assert.equal(journeyChapter(chapter, perspective, "shared").price, "4,20 €");
      assert.equal(journeyChapter(chapter, perspective, null).price, "4,20 €");
    }
  }
  assert.notEqual(journeyChapter(1, "driver", null).video, journeyChapter(1, "passenger", null).video);
  assert.match(journeyChapter(4, "driver", "gift").body, /offert/);
  assert.match(journeyChapter(4, "passenger", "shared").body, /partagés/);
});
