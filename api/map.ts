import { kingdom, storeHandler } from '../src/lib/server/mightpulse-discovery.js';
import { getMap } from '../src/lib/server/mightpulse-map.js';

export default storeHandler(10, async params => {
  const kid = kingdom(params)!;
  const { data, seconds } = await getMap(kid, params.get('fresh') === '1');
  return [data.ok ? 200 : 202, data, seconds];
});
