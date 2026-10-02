import { useState } from 'react';

let openings = 0;

export const useOpening = () => useState(() => ++openings)[0];
