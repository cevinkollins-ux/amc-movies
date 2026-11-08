// Fake data shaped like AMC API responses, for trying the app without a live key.

const theatres = [
  { id: 101, longName: 'AMC Lincoln Square 13', location: { city: 'New York', state: 'NY', postalCode: '10023' } },
  { id: 102, longName: 'AMC 34th Street 14', location: { city: 'New York', state: 'NY', postalCode: '10001' } },
  { id: 103, longName: 'AMC Empire 25', location: { city: 'New York', state: 'NY', postalCode: '10036' } },
  { id: 104, longName: 'AMC Newport Centre 11', location: { city: 'Jersey City', state: 'NJ', postalCode: '07310' } },
];

const movies = [
  { id: 1, name: 'Starfall', mpaaRating: 'PG-13', runTime: 128 },
  { id: 2, name: 'Starfall: The IMAX Experience', mpaaRating: 'PG-13', runTime: 128 },
  { id: 3, name: 'The Quiet Harbor', mpaaRating: 'R', runTime: 104 },
  { id: 4, name: 'Paper Kites', mpaaRating: 'PG', runTime: 95 },
];

export const mockTheatres = () => theatres;
export const mockMovies = () => movies;

// Deterministic showtimes per theatre/date, including one after midnight.
export function mockShowtimes(theatreId, isoDate) {
  const day = Number(isoDate.slice(-2));
  const seed = Number(theatreId) + day;
  const times = ['11:00', '13:45', '16:30', '18:15', '19:30', '21:00', '22:40'];
  const out = [];
  let n = 0;
  for (const m of movies) {
    times.forEach((t, i) => {
      if ((seed + i + m.id) % 3 === 0) return;
      out.push({
        id: Number(`${theatreId}${day}${m.id}${i}`),
        movieId: m.id,
        movieName: m.name,
        theatreId: Number(theatreId),
        showDateTimeLocal: `${isoDate}T${t}:00`,
        isSoldOut: (seed + i) % 11 === 0,
        isAlmostSoldOut: (seed + i) % 7 === 0,
        premiumFormat: m.name.includes('IMAX') ? 'IMAX' : n++ % 4 === 0 ? 'Dolby Cinema' : '',
        attributes: [],
        purchaseUrl: 'https://www.amctheatres.com/',
      });
    });
  }
  // A late show that technically starts the next calendar day.
  const next = new Date(`${isoDate}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  out.push({
    id: Number(`${theatreId}${day}99`),
    movieId: 1,
    movieName: 'Starfall',
    theatreId: Number(theatreId),
    showDateTimeLocal: `${next.toISOString().slice(0, 10)}T00:15:00`,
    purchaseUrl: 'https://www.amctheatres.com/',
  });
  return out;
}
