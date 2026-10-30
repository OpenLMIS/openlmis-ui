import { expect, it } from 'vitest';
import { catalogUploadIssue } from '@/features/cce-catalog/lib/upload-errors';
import { httpError, networkError } from '@/test-utils/http-error';

const refused = (messageKey: string, message: string) => httpError(400, { messageKey, message });

it.each([
  [
    'real unknown heading',
    refused('cce.error.upload.header.invalid', 'Invalid Headers in upload file: [maker].'),
    { kind: 'unknown-columns', columns: 'maker' },
  ],
  [
    'several unknown headings',
    refused('cce.error.upload.header.invalid', 'Invalid Headers in upload file: [maker, size].'),
    { kind: 'unknown-columns', columns: 'maker, size' },
  ],
  [
    'real byte order mark',
    refused(
      'cce.error.upload.header.invalid',
      'Invalid Headers in upload file: [﻿from pqs catalog].',
    ),
    { kind: 'byte-order-mark' },
  ],
  [
    'missing columns',
    refused(
      'cce.error.upload.mandatory.columns.missing',
      'Missing Mandatory column in upload file: [Type, Model].',
    ),
    { kind: 'missing-columns', columns: 'Type, Model' },
  ],
  [
    'missing heading',
    refused('cce.error.upload.header.missing', 'Header for column 3 is missing.'),
    { kind: 'missing-heading', column: '3' },
  ],
  [
    'real lowercase energy source',
    refused(
      'cce.error.upload.record.invalid',
      "Error found while parsing in row 1: 'gasoline' could not be parsed as an EnergySource.",
    ),
    { kind: 'energy-source', line: 2, value: 'gasoline' },
  ],
  [
    'storage temperature',
    refused(
      'cce.error.upload.record.invalid',
      "Error found while parsing in row 12: 'minus5' could not be parsed as a StorageTemperature.",
    ),
    { kind: 'storage-temperature', line: 13, value: 'minus5' },
  ],
  [
    'real malformed dimensions',
    refused(
      'cce.error.upload.record.invalid',
      "Error found while parsing in row 1: 'abc' could not be parsed as Dimensions.",
    ),
    { kind: 'dimensions', line: 2, value: 'abc' },
  ],
  [
    'whole number',
    refused(
      'cce.error.upload.record.invalid',
      "Error found while parsing in row 7: '4.5x' could not be parsed as an Integer.",
    ),
    { kind: 'integer', line: 8, value: '4.5x' },
  ],
  [
    'another parse reason',
    refused(
      'cce.error.upload.record.invalid',
      "Error found while parsing in row 3: 'maybe' could not be parsed as a Boolean.",
    ),
    { kind: 'row', line: 4, reason: "'maybe' could not be parsed as a Boolean" },
  ],
  [
    'duplicate in file',
    refused(
      'cce.error.catalog.duplicateInFile',
      'The file contains more than one row for the CCE Catalog Item with manufacturer B Medical and model RCW 50 EG.',
    ),
    { kind: 'duplicate-in-file', manufacturer: 'B Medical', model: 'RCW 50 EG' },
  ],
  [
    'required field',
    refused('cce.error.catalog.field.required', 'CCE Catalog Item must have type field.'),
    { kind: 'required-field', field: 'type' },
  ],
])('explains a refused upload: %s', (_name, error, issue) => {
  expect(catalogUploadIssue(error)).toEqual(issue);
});

it.each([
  ['an unknown key', refused('cce.error.something.new', 'Something new went wrong.')],
  [
    'a reworded known message',
    refused('cce.error.upload.record.invalid', 'Row 1 has a problem with gasoline.'),
  ],
  ['a server error', httpError(500, { messageKey: 'cce.error.upload.header.invalid' })],
  ['no response', networkError()],
])('leaves %s to the server text', (_name, error) => {
  expect(catalogUploadIssue(error)).toBeUndefined();
});
