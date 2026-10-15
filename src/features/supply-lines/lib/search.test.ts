import { describe, expect, it } from 'vitest';
import { supplyLinesSearchSchema, toSupplyLinesQuery } from '@/features/supply-lines/lib/search';

describe('supply line search contract', () => {
  it.each(['supplyingFacility.name', 'supervisoryNode.code', 'program.name'])(
    'maps the supported dotted sort %s to the server request',
    (sort) => {
      expect(
        toSupplyLinesQuery(supplyLinesSearchSchema.parse({ sort, dir: 'desc', page: 3 })),
      ).toEqual({ page: 2, size: 10, sort: `${sort},desc` });
    },
  );

  it('falls back from obsolete or unsupported sorts and excludes unsupported search params', () => {
    const supplyingFacilityId = 'e6799d64-d10d-4011-b8c2-0e4d4a3f65ce';
    const programId = 'dce17f2e-af3e-40ad-8e00-3496adef44c3';

    for (const sort of ['supplyingFacilityName', 'supervisoryNode.name', 'id']) {
      expect(
        toSupplyLinesQuery(
          supplyLinesSearchSchema.parse({
            sort,
            supplyingFacilityId,
            programId,
            supervisoryNodeId: 'unrelated-node',
            expand: 'supervisoryNode.requisitionGroup.memberFacilities',
            q: 'unsupported',
          }),
        ),
      ).toEqual({
        page: 0,
        size: 10,
        sort: 'supplyingFacility.name,asc',
        supplyingFacilityId,
        programId,
      });
    }
  });
});
