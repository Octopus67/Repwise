import {
  colors,
  spacing,
  typography,
  radius,
  shadows,
  springs,
  opacityScale,
  motion,
  letterSpacing,
  elevation,
  theme,
} from '../../theme/tokens';

describe('Token System Snapshot', () => {
  // Snapshot each token category to catch unintended changes
  test('colors tokens match snapshot', () => { expect(colors).toMatchSnapshot(); });
  test('spacing tokens match snapshot', () => { expect(spacing).toMatchSnapshot(); });
  test('typography tokens match snapshot', () => { expect(typography).toMatchSnapshot(); });
  test('radius tokens match snapshot', () => { expect(radius).toMatchSnapshot(); });
  test('shadows tokens match snapshot', () => { expect(shadows).toMatchSnapshot(); });
  test('springs tokens match snapshot', () => { expect(springs).toMatchSnapshot(); });
  test('opacityScale tokens match snapshot', () => { expect(opacityScale).toMatchSnapshot(); });
  test('motion tokens match snapshot', () => { expect(motion).toMatchSnapshot(); });
  test('letterSpacing tokens match snapshot', () => { expect(letterSpacing).toMatchSnapshot(); });
  test('elevation tokens match snapshot', () => { expect(elevation).toMatchSnapshot(); });

  // Shape test — verify all expected categories exist
  test('theme exports all token categories', () => {
    expect(Object.keys(theme).sort()).toMatchSnapshot();
  });
});
