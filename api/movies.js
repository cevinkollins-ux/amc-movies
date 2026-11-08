import { handler } from '../lib/http.js';
import { listMovies } from '../lib/amc.js';

// Now playing plus advance-ticket movies.
export default handler(() => listMovies(), 60 * 60);
