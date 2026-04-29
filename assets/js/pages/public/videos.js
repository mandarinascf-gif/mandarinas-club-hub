document.addEventListener("DOMContentLoaded", () => {
  const channelVideosUrl = "https://www.youtube.com/@MandarinasCF/videos";
  const channelHomeUrl = "https://www.youtube.com/@MandarinasCF";
  const openChannelLink = document.getElementById("videos-open-channel");
  const videosCount = document.getElementById("videos-count");
  const videosFeatured = document.getElementById("videos-featured");
  const videosList = document.getElementById("videos-list");
  const uploads = [
    {
      title: "4/23/2026 Spring Season 🍀 Final - Field 1 55 minutes",
      videoId: "ukWzH6lEt9E",
      views: "12 views",
      published: "2 days ago",
    },
    {
      title: "4/23/2026 Spring Season 🍀 FINAL - Field 2 59 minutes",
      videoId: "4zZ10rmVdCk",
      views: "13 views",
      published: "2 days ago",
    },
    {
      title: "4/9/2026 Spring Season 🍀 MD 6 - Field 2 57 minutes",
      videoId: "gAv4MxIGgYw",
      views: "68 views",
      published: "2 weeks ago",
    },
    {
      title: "4/2/2026 Spring Season 🍀 MD 5 - Field 2 1 hour",
      videoId: "tOqxKhydRlM",
      views: "30 views",
      published: "3 weeks ago",
    },
    {
      title: "4/2/2026 Spring Season 🍀 MD 5 - Field 1 58 minutes",
      videoId: "B7KewZ5kLkU",
      views: "38 views",
      published: "3 weeks ago",
    },
    {
      title: "Spring Season 🍀 MD 4 - Field 2 [3/26/2026] 58 minutes",
      videoId: "VSkVDDgwF_A",
      views: "40 views",
      published: "4 weeks ago",
    },
    {
      title: "Spring Season 🍀 MD 4 - Field 1 [3/26/2026] 59 minutes",
      videoId: "kF3TE-73w6k",
      views: "33 views",
      published: "4 weeks ago",
    },
    {
      title: "Spring Season 🍀 MD 3 - Field 1 58 minutes",
      videoId: "Tw_nJQnGV_w",
      views: "23 views",
      published: "1 month ago",
    },
    {
      title: "Spring Season 🍀 MD 3 - Field 2 57 minutes",
      videoId: "89lKYUxbPPI",
      views: "53 views",
      published: "1 month ago",
    },
    {
      title: "Spring Season 🍀 MD 2 - Field 2 58 minutes",
      videoId: "p_-Rbp3GHtY",
      views: "45 views",
      published: "1 month ago",
    },
    {
      title: "Spring Season 🍀 MD 2 - Field 1 58 minutes",
      videoId: "chYV1sAuOck",
      views: "56 views",
      published: "1 month ago",
    },
    {
      title: "Spring Season 🍀 MD 1 - Field 2 58 minutes",
      videoId: "149lDWxuc8k",
      views: "32 views",
      published: "1 month ago",
    },
    {
      title: "Spring Season 🍀 MD 1 - Field 1 59 minutes",
      videoId: "UXc8dV4QQqY",
      views: "53 views",
      published: "1 month ago",
    },
    {
      title: "🥶🌧️ Field 2 - Season Finals 25 minutes",
      videoId: "U2s8orU_Tzc",
      views: "49 views",
      published: "1 month ago",
    },
    {
      title: "🥶🌧️ Field 1 - Season Finals 46 minutes",
      videoId: "U5P7vUZja7A",
      views: "51 views",
      published: "1 month ago",
    },
    {
      title: "🥶🌧️⚽️ MD4 55 minutes",
      videoId: "CG11drRmuMQ",
      views: "55 views",
      published: "2 months ago",
    },
    {
      title: "2026 Winter Season - MD2 Game 2 28 minutes",
      videoId: "usWrIq3ZNYU",
      views: "40 views",
      published: "3 months ago",
    },
    {
      title: "2026 Winter Season - MD2 Game 1 30 minutes",
      videoId: "PB24yqYcSI0",
      views: "33 views",
      published: "3 months ago",
    },
    {
      title: "MD 5 2nd Game 30 minutes",
      videoId: "g72W_cIFIl4",
      views: "20 views",
      published: "4 months ago",
    },
    {
      title: "MD 5 1st Game 27 minutes",
      videoId: "-eo-sGRvj8s",
      views: "18 views",
      published: "4 months ago",
    },
    {
      title: "🌞🌛Season Final 50 minutes",
      videoId: "QDMtoEIeRmA",
      views: "40 views",
      published: "7 months ago",
    },
    {
      title: "MATCH DAY 5 🌞🌛 - COURT 1 - GAMES 1 & 2 50 minutes",
      videoId: "pqCVzSH1ekw",
      views: "102 views",
      published: "8 months ago",
    },
    {
      title: "☀️ MATCH DAY 5 - FIELD 2 - GAMES 1 & 2 48 minutes",
      videoId: "o-VFiFoWfyw",
      views: "63 views",
      published: "10 months ago",
    },
    {
      title: "☀️ MATCHDAY 4 GAMES 1 & 2 49 minutes",
      videoId: "BDgzuKMBDAI",
      views: "46 views",
      published: "11 months ago",
    },
    {
      title: "☀️ MATCHDAY 1 - FIELD 2 - GAMES 1 & 2 49 minutes",
      videoId: "AgzU1bcYJLI",
      views: "90 views",
      published: "11 months ago",
    },
    {
      title: "SPRING '25 FINALS COURT 1 SD 480p 52 minutes",
      videoId: "nYI5mu9M6tc",
      views: "52 views",
      published: "11 months ago",
    },
    {
      title: "MATCHDAY 7 GAMES 1 AND 2 50 minutes",
      videoId: "JSpAzCMss1U",
      views: "54 views",
      published: "1 year ago",
    },
    {
      title: "Match Day 5 - Court 2 - Game 1 & 2 48 minutes",
      videoId: "txzm90gbhDI",
      views: "72 views",
      published: "1 year ago",
    },
    {
      title: "Spring ‘25 MatchDay2 Game1 22 minutes",
      videoId: "o3m0H5pl-3U",
      views: "59 views",
      published: "1 year ago",
    },
    {
      title: "Spring ‘25 MatchDay2 Game2 24 minutes",
      videoId: "KytP0fm3JRQ",
      views: "59 views",
      published: "1 year ago",
    },
  ];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function videoUrl(videoId) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  }

  function videoThumbnailUrl(videoId) {
    return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
  }

  function videoMatchdayLabel(video) {
    const title = String(video?.title || "");
    const matchdayMatch = title.match(/\b(MD|Match ?Day)\s*([0-9]+)/i);
    if (matchdayMatch) {
      return `Matchday ${matchdayMatch[2]}`;
    }

    if (/final/i.test(title)) {
      return "Season final";
    }

    if (/spring/i.test(title)) {
      return "Spring season";
    }

    if (/winter/i.test(title)) {
      return "Winter season";
    }

    return "Club archive";
  }

  function videoCardMarkup(video) {
    return `
      <a
        class="video-card"
        href="${videoUrl(video.videoId)}"
        target="_blank"
        rel="noreferrer"
      >
        <div class="video-card-media">
          <img
            src="${videoThumbnailUrl(video.videoId)}"
            alt="${escapeHtml(video.title)} thumbnail"
            loading="lazy"
          />
        </div>
        <div class="video-card-body">
          <div class="section-label">${escapeHtml(videoMatchdayLabel(video))}</div>
          <div class="video-card-title">${escapeHtml(video.title)}</div>
          <div class="video-card-meta">
            <span>${escapeHtml(video.published)}</span>
            <span>${escapeHtml(video.views)}</span>
          </div>
          <span class="video-card-cta">Open on YouTube</span>
        </div>
      </a>
    `;
  }

  if (openChannelLink) {
    openChannelLink.href = channelVideosUrl;
  }

  document
    .querySelectorAll('a[href="https://www.youtube.com/@MandarinasCF/videos"]')
    .forEach((link) => {
      link.href = channelVideosUrl;
    });

  document
    .querySelectorAll('a[href="https://www.youtube.com/@MandarinasCF"]')
    .forEach((link) => {
      link.href = channelHomeUrl;
    });

  if (videosCount) {
    videosCount.textContent = `${uploads.length} uploads`;
  }

  if (!videosList) {
    return;
  }

  if (!uploads.length) {
    if (videosFeatured) {
      videosFeatured.innerHTML = `
        <div class="empty-state">
          The latest match video is not available right now. Use
          <a href="${channelVideosUrl}" target="_blank" rel="noreferrer">YouTube</a>
          to open the channel directly.
        </div>
      `;
    }
    videosList.innerHTML = `
      <div class="empty-state">
        The video list is not available right now. Use
        <a href="${channelVideosUrl}" target="_blank" rel="noreferrer">YouTube</a>
        to open the channel directly.
      </div>
    `;
    return;
  }

  const [featuredVideo, ...archiveVideos] = uploads;
  const visibleArchiveVideos = archiveVideos.slice(0, 4);
  const olderArchiveVideos = archiveVideos.slice(4);

  if (videosFeatured && featuredVideo) {
    videosFeatured.innerHTML = `
      <a
        class="video-featured-card"
        href="${videoUrl(featuredVideo.videoId)}"
        target="_blank"
        rel="noreferrer"
      >
        <div class="video-featured-media">
          <img
            src="${videoThumbnailUrl(featuredVideo.videoId)}"
            alt="${escapeHtml(featuredVideo.title)} thumbnail"
            loading="lazy"
          />
        </div>
        <div class="video-featured-body">
          <div class="section-label">${escapeHtml(videoMatchdayLabel(featuredVideo))}</div>
          <div class="video-featured-title">${escapeHtml(featuredVideo.title)}</div>
          <div class="video-featured-meta">
            <span>${escapeHtml(featuredVideo.published)}</span>
            <span>${escapeHtml(featuredVideo.views)}</span>
          </div>
          <span class="video-card-cta">Open latest video</span>
        </div>
      </a>
    `;
  }

  if (!visibleArchiveVideos.length && !olderArchiveVideos.length) {
    videosList.innerHTML = `
      <div class="empty-state">
        No older uploads yet. Use
        <a href="${channelVideosUrl}" target="_blank" rel="noreferrer">YouTube</a>
        to follow the full channel feed.
      </div>
    `;
    return;
  }

  videosList.innerHTML = `
    ${
      visibleArchiveVideos.length
        ? `
          <section class="history-stack">
            <div class="subtable-head">
              <div>
                <h3>Recent uploads</h3>
                <p>Keep the latest clips in view. Older uploads stay tucked away until you need the archive.</p>
              </div>
            </div>
            <div class="video-card-list">
              ${visibleArchiveVideos.map((video) => videoCardMarkup(video)).join("")}
            </div>
          </section>
        `
        : ""
    }
    ${
      olderArchiveVideos.length
        ? `
          <details class="disclosure-card">
            <summary class="disclosure-summary">
              <div class="disclosure-copy">
                <div class="disclosure-title">Older uploads</div>
                <div class="manual-note">Open the remaining ${escapeHtml(
                  olderArchiveVideos.length
                )} videos only when you need the deeper backlog.</div>
              </div>
            </summary>
            <div class="disclosure-body">
              <div class="video-card-list">
                ${olderArchiveVideos.map((video) => videoCardMarkup(video)).join("")}
              </div>
            </div>
          </details>
        `
        : ""
    }
  `;
});
