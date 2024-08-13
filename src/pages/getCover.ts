import type { APIRoute } from "astro";
import axios from "axios";
import * as cheerio from "cheerio";

export const GET: APIRoute = async ({ params, request }) => {
  const spotifyUrl = request.headers.get("x-spotify-url");
  const resolution = parseInt(request.headers.get("x-resolution") || "640", 10);

  if (!spotifyUrl) {
    return new Response(
      JSON.stringify({ error: "No Spotify URL provided!" }),
      { status: 400 }
    );
  }

  try {
    const embedUrl = `https://open.spotify.com/embed${new URL(spotifyUrl).pathname}`;
    const { songName, artists, coverArtUrl } = await fetchSpotifyData(embedUrl, resolution);

    if (coverArtUrl) {
      return new Response(
        JSON.stringify({
          songName,
          artists,
          coverArtUrl,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Failed to find cover art URL!" }),
        { status: 404 }
      );
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: `Failed to process request: ${error.message}`,
      }),
      { status: 500 }
    );
  }
};

async function fetchSpotifyData(embedUrl: string, resolution: number) {
  try {
    const embedResponse = await axios.get(embedUrl);
    const $ = cheerio.load(embedResponse.data);

    const pageProps = $('#__NEXT_DATA__').html();
    if (!pageProps) {
      throw new Error('Failed to find pageProps!');
    }

    const pageJson = JSON.parse(pageProps);

    const entity = pageJson.props.pageProps.state.data.entity;

    const songName = entity.name;
    const artists = entity.artists;

    const coverArt = entity.coverArt.sources;

    let coverArtUrl = '';
    for (const art of coverArt) {
      if (art.width === resolution && art.height === resolution) {
        coverArtUrl = art.url;
        break;
      }
    }

    // Fallback
    if (!coverArtUrl && coverArt.length > 0) {
      coverArtUrl = coverArt[0].url;
    }

    if (!coverArtUrl) {
      throw new Error('Failed to find art url!');
    }

    return { songName, artists, coverArtUrl };
  } catch (error: any) {
    throw new Error(`Failed to fetch embed page! ${error.message}`);
  }
}
