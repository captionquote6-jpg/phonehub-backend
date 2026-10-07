require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const zlib = require("zlib");

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const PUBLIC_BASE_URL =
    (process.env.PUBLIC_BASE_URL || "https://phonehub-backend-bbx9.onrender.com")
        .replace(/\/$/, "");

/* =========================================================
   APP CONFIG
========================================================= */

app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, "data");

const GETTECH_INDEX_FILE = path.join(
    DATA_DIR,
    "gettech-index.jsonl.gz"
);

const UPCOMING_FILE = path.join(
    DATA_DIR,
    "upcoming-2027.json"
);

/* =========================================================
   MEMORY CACHE
========================================================= */

let getTechPhones = [];

let getTechLoaded = false;

let getTechLoading = false;

let getTechLoadError = null;

let getTechLoadedAt = null;


/* =========================================================
   ENSURE DATA DIRECTORY
========================================================= */

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}


/* =========================================================
   HELPERS
========================================================= */

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


/* =========================================================
   SAFE STRING
========================================================= */

function safeString(value, fallback = "-") {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return fallback;
    }

    return String(value);
}


/* =========================================================
   BRAND FORMAT
========================================================= */

function formatBrand(value) {

    if (!value) {
        return "Unknown";
    }

    const brand = String(value)
        .trim();

    if (!brand) {
        return "Unknown";
    }

    return brand
        .split(/[\s_-]+/)
        .map(word => {
            if (!word) {
                return "";
            }

            return (
                word.charAt(0).toUpperCase() +
                word.slice(1)
            );
        })
        .join(" ");
}


/* =========================================================
   DISPLAY VALUE
========================================================= */

function formatDisplay(display) {

    if (!display) {
        return "-";
    }

    if (typeof display === "string") {
        return display;
    }

    if (typeof display === "object") {

        const size =
            display.size_inch ??
            display.size ??
            "";

        const resolution =
            display.resolution ??
            "";

        const type =
            display.type ??
            "";

        const parts = [];

        if (size) {
            parts.push(`${size}"`);
        }

        if (resolution) {
            parts.push(resolution);
        }

        if (type) {
            parts.push(type);
        }

        if (parts.length > 0) {
            return parts.join(" â€¢ ");
        }
    }

    return "-";
}


/* =========================================================
   RAM
========================================================= */

function formatRam(phone) {

    if (
        phone.ram_gb !== undefined &&
        phone.ram_gb !== null
    ) {

        if (Array.isArray(phone.ram_gb)) {

            return phone.ram_gb
                .map(value => `${value} GB`)
                .join(" / ");
        }

        return `${phone.ram_gb} GB`;
    }

    if (phone.ram) {
        return String(phone.ram);
    }

    return "-";
}


/* =========================================================
   BATTERY
========================================================= */

function formatBattery(phone) {

    if (
        phone.battery_mah !== undefined &&
        phone.battery_mah !== null
    ) {

        if (Array.isArray(phone.battery_mah)) {

            return phone.battery_mah
                .map(value => `${value} mAh`)
                .join(" / ");
        }

        return `${phone.battery_mah} mAh`;
    }

    if (phone.battery) {
        return String(phone.battery);
    }

    return "-";
}


/* =========================================================
   PROCESSOR
========================================================= */

function formatProcessor(phone) {

    if (phone.soc) {
        return String(phone.soc);
    }

    if (phone.chipset) {
        return String(phone.chipset);
    }

    if (phone.processor) {
        return String(phone.processor);
    }

    return "-";
}


/* =========================================================
   STORAGE
========================================================= */

function formatStorage(phone) {

    if (
        phone.storage_gb !== undefined &&
        phone.storage_gb !== null
    ) {

        if (Array.isArray(phone.storage_gb)) {

            return phone.storage_gb
                .map(value => `${value} GB`)
                .join(" / ");
        }

        return `${phone.storage_gb} GB`;
    }

    if (phone.storage) {
        return String(phone.storage);
    }

    if (phone.internal_storage) {
        return String(phone.internal_storage);
    }

    return "-";
}


/* =========================================================
   CAMERA
========================================================= */

function formatCamera(phone) {

    if (phone.camera) {
        return String(phone.camera);
    }

    if (phone.main_camera) {
        return String(phone.main_camera);
    }

    if (phone.rear_camera) {
        return String(phone.rear_camera);
    }

    return "-";
}


/* =========================================================
   ROBUST IMAGE / DISPLAY EXTRACTION
========================================================= */

function normalizeUrl(value) {

    if (!value) {
        return "";
    }

    const text = String(value).trim();

    if (text.startsWith("//")) {
        return "https:" + text;
    }

    if (
        text.startsWith("http://") ||
        text.startsWith("https://")
    ) {
        return text;
    }

    return "";
}


function findImageDeep(value, depth = 0) {

    if (depth > 8 || value === null || value === undefined) {
        return "";
    }

    if (typeof value !== "object") {
        return "";
    }

    const priorityKeys = [
        "image",
        "image_url",
        "imageUrl",
        "img",
        "img_url",
        "imgUrl",
        "thumbnail",
        "thumbnail_url",
        "thumbnailUrl",
        "photo",
        "photo_url",
        "photoUrl",
        "picture",
        "picture_url",
        "pictureUrl",
        "front_image",
        "front_image_url",
        "frontImage",
        "main_image",
        "mainImage",
        "hero_image",
        "heroImage"
    ];

    for (const key of priorityKeys) {

        if (Object.prototype.hasOwnProperty.call(value, key)) {

            const child = value[key];

            if (typeof child === "string") {
                const url = normalizeUrl(child);
                if (url) {
                    return url;
                }
            }

            if (child && typeof child === "object") {
                const found = findImageDeep(child, depth + 1);
                if (found) {
                    return found;
                }
            }
        }
    }

    // IMPORTANT: Do not scan arbitrary strings, source_urls, links,
    // or generic URL arrays. That was causing unrelated Wikipedia
    // images to be selected as phone images.
    for (const [key, child] of Object.entries(value)) {

        const lowerKey = String(key).toLowerCase();

        if (
            lowerKey.includes("image") ||
            lowerKey.includes("thumbnail") ||
            lowerKey === "img" ||
            lowerKey.includes("photo") ||
            lowerKey.includes("picture")
        ) {

            const found = findImageDeep(child, depth + 1);

            if (found) {
                return found;
            }
        }
    }

    return "";
}


function extractImageUrl(phone) {

    const direct =
        normalizeUrl(
            phone.image ||
            phone.img ||
            phone.image_url ||
            phone.imageUrl ||
            phone.thumbnail ||
            phone.thumbnail_url ||
            phone.thumbnailUrl ||
            ""
        );

    if (direct) {
        return direct;
    }

    if (phone.raw) {

        const rawImage = findImageDeep(phone.raw);

        if (rawImage) {
            return rawImage;
        }
    }

    return "";
}


function normalizeModelText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function knownOfficialImage(phone) {

    const id = normalizeModelText(
        phone.slug || phone.id || phone.base_model_slug || ""
    );

    const name = normalizeModelText(phone.name || "");

    // Apple iPhone Duo — official Apple newsroom image.
    if (
        id === "iphone duo" ||
        id === "iphone-duo" ||
        name === "iphone duo"
    ) {
        return "https://www.apple.com/newsroom/images/2026/09/apple-unveils-iphone-duo/article/Apple-iPhone-Duo-colors-260909_big.jpg.large.jpg";
    }

    return "";
}


async function resolveImageFromWikipedia(phone) {

    const brand = String(phone.brand || "").trim();
    const name = String(phone.name || "").trim();

    if (!name) {
        return "";
    }

    const query = [brand, name]
        .filter(Boolean)
        .join(" ");

    const apiUrl =
        "https://en.wikipedia.org/w/api.php" +
        "?action=query" +
        "&generator=search" +
        "&gsrnamespace=0" +
        "&gsrlimit=5" +
        "&gsrsearch=" + encodeURIComponent(query) +
        "&prop=pageimages" +
        "&piprop=thumbnail" +
        "&pithumbsize=1000" +
        "&format=json";

    try {

        const response = await fetch(apiUrl, {
            redirect: "follow",
            headers: {
                "User-Agent": "PhoneHub/1.0 (exact phone image resolver)"
            },
            signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) {
            return "";
        }

        const json = await response.json();
        const pages = json && json.query && json.query.pages
            ? Object.values(json.query.pages)
            : [];

        const wanted = normalizeModelText(name);
        const wantedTokens = wanted
            .split(" ")
            .filter(token => token.length >= 2);

        // Prefer a page whose title closely matches the exact model.
        pages.sort((a, b) => {
            const at = normalizeModelText(a.title || "");
            const bt = normalizeModelText(b.title || "");

            const as = at === wanted ? 100 : wantedTokens.filter(t => at.includes(t)).length;
            const bs = bt === wanted ? 100 : wantedTokens.filter(t => bt.includes(t)).length;

            return bs - as;
        });

        for (const page of pages) {

            const title = normalizeModelText(page.title || "");
            const thumb = page.thumbnail && page.thumbnail.source
                ? page.thumbnail.source
                : "";

            if (!thumb) {
                continue;
            }

            const strongMatch =
                title === wanted ||
                (wantedTokens.length >= 2 &&
                 wantedTokens.every(token => title.includes(token)));

            if (strongMatch) {
                return thumb;
            }
        }

    } catch (_) {
        // Exact search failed; caller will continue to next source.
    }

    return "";
}


function isGenericWikipediaSource(url) {

    const value = String(url || "").toLowerCase();

    return (
        value.includes("/wiki/list_of_") ||
        value.includes("/wiki/list of ") ||
        value.includes("wikipedia.org/wiki/list")
    );
}


function extractDisplayValue(phone) {

    if (phone.display) {
        return phone.display;
    }

    const candidates = [
        phone.screen,
        phone.display_spec,
        phone.displaySpecs,
        phone.screen_spec,
        phone.screenSpecs
    ];

    for (const value of candidates) {

        if (value) {
            return formatDisplay(value);
        }
    }

    if (phone.raw && typeof phone.raw === "object") {

        const raw = phone.raw;

        const rawCandidates = [
            raw.display,
            raw.screen,
            raw.display_spec,
            raw.displaySpecs,
            raw.screen_spec,
            raw.screenSpecs
        ];

        for (const value of rawCandidates) {

            if (value) {
                return formatDisplay(value);
            }
        }

        const rawText = JSON.stringify(raw).toLowerCase();

        if (
            rawText.includes("display") ||
            rawText.includes("screen")
        ) {

            for (const [key, value] of Object.entries(raw)) {

                const k = String(key).toLowerCase();

                if (
                    k.includes("display") ||
                    k.includes("screen")
                ) {

                    const formatted =
                        formatDisplay(value);

                    if (formatted !== "-") {
                        return formatted;
                    }
                }
            }
        }
    }

    return "-";
}


/* =========================================================
   NORMALIZE GETTECH PHONE
========================================================= */

function normalizePhone(phone, index = 0) {

    const name =
        phone.name ||
        phone.model ||
        phone.title ||
        "Unknown Phone";

    const brand =
        formatBrand(
            phone.brand ||
            phone.manufacturer ||
            name.split(" ")[0]
        );

    const releaseDate =
        phone.release_date ||
        phone.releaseDate ||
        "";

    let category = "Smartphone";

    return {

        id:
            phone.slug ||
            phone.id ||
            phone.base_model_slug ||
            `gettech-${index}`,

        brand:

            brand,

        name:

            safeString(
                name,
                "Unknown Phone"
            ),

        category:

            category,

        price:

            safeString(
                phone.price,
                "-"
            ),

        display:

            extractDisplayValue(
                phone
            ),

        processor:

            formatProcessor(
                phone
            ),

        ram:

            formatRam(
                phone
            ),

        storage:

            formatStorage(
                phone
            ),

        camera:

            formatCamera(
                phone
            ),

        battery:

            formatBattery(
                phone
            ),

        os:

            safeString(
                phone.os,
                "-"
            ),

        image:

            extractImageUrl(
                phone
            ) ||
            `${PUBLIC_BASE_URL}/api/phone-image/${encodeURIComponent(
                phone.slug ||
                phone.id ||
                phone.base_model_slug ||
                `gettech-${index}`
            )}`,

        release_date:

            releaseDate,

        release_year:

            releaseDate
                ? String(releaseDate).substring(0, 4)
                : "",

        verified:

            phone.verified === true,

        weight:

            phone.weight_g !== undefined
                ? `${phone.weight_g} g`
                : "-",

        source_urls:

            Array.isArray(
                phone.source_urls
            )
                ? phone.source_urls
                : [],

        // Do not keep the full original JSON object in RAM.
        // The normalized fields above are sufficient for the API.
    };
}


/* =========================================================
   LOAD GETTECH INDEX
========================================================= */

async function loadGetTechIndex() {

    if (getTechLoaded) {
        return getTechPhones;
    }

    if (getTechLoading) {

        while (getTechLoading) {
            await sleep(100);
        }

        return getTechPhones;
    }

    if (
        !fs.existsSync(
            GETTECH_INDEX_FILE
        )
    ) {

        throw new Error(
            "GetTech index file not found: " +
            GETTECH_INDEX_FILE
        );
    }

    getTechLoading = true;

    getTechLoadError = null;

    console.log("");
    console.log(
        "=========================================="
    );
    console.log(
        "LOADING GETTECH PHONE DATABASE"
    );
    console.log(
        "=========================================="
    );

    console.log(
        `Index: ${GETTECH_INDEX_FILE}`
    );

    const phones = [];

    let processed = 0;

    let failed = 0;

    const input = fs.createReadStream(GETTECH_INDEX_FILE).pipe(zlib.createGunzip()).setEncoding("utf8");

    const rl =
        readline.createInterface({
            input,
            crlfDelay: Infinity
        });

    try {

        for await (
            const line of rl
        ) {

            const trimmed =
                line.trim();

            if (!trimmed) {
                continue;
            }

            try {

                const json =
                    JSON.parse(
                        trimmed
                    );

                const phone =
                    normalizePhone(
                        json,
                        processed
                    );

                phones.push(
                    phone
                );

                processed++;

                if (
                    processed % 10000 === 0
                ) {

                    console.log(
                        `Loaded: ${processed} phones`
                    );
                }

            } catch (error) {

                failed++;

                if (
                    failed <= 10
                ) {

                    console.log(
                        "Index row error:",
                        error.message
                    );
                }
            }
        }

        getTechPhones =
            phones;

        getTechLoaded =
            true;

        getTechLoadedAt =
            new Date();

        console.log("");
        console.log(
            "=========================================="
        );
        console.log(
            "GETTECH DATABASE LOADED"
        );
        console.log(
            "=========================================="
        );

        console.log(
            `Total phones: ${phones.length}`
        );

        console.log(
            `Failed rows: ${failed}`
        );

        console.log(
            `Loaded at: ${getTechLoadedAt.toISOString()}`
        );

        console.log(
            "=========================================="
        );

        console.log("");

        return phones;

    } catch (error) {

        getTechLoadError =
            error.message;

        console.log(
            "GetTech database load failed:",
            error.message
        );

        throw error;

    } finally {

        getTechLoading =
            false;
    }
}


/* =========================================================
   GETTECH STATUS
========================================================= */

app.get(
    "/api/gettech/status",
    async (req, res) => {

        try {

            const stats =
                fs.existsSync(
                    GETTECH_INDEX_FILE
                )
                    ? fs.statSync(
                        GETTECH_INDEX_FILE
                    )
                    : null;

            res.json({

                success: true,

                provider:
                    "GetTechAPI",

                source:
                    "Local GetTech smartphone dataset",

                indexFile:
                    GETTECH_INDEX_FILE,

                indexExists:
                    !!stats,

                indexSizeMB:
                    stats
                        ? Number(
                            (
                                stats.size /
                                1024 /
                                1024
                            ).toFixed(2)
                        )
                        : 0,

                loaded:
                    getTechLoaded,

                loading:
                    getTechLoading,

                phoneCount:
                    getTechPhones.length,

                loadedAt:
                    getTechLoadedAt
                        ? getTechLoadedAt.toISOString()
                        : null,

                error:
                    getTechLoadError
                        ? getTechLoadError
                        : null

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    error.message

            });
        }
    }
);


/* =========================================================
   IMAGE FALLBACK / PROXY
========================================================= */

const imageUrlCache = new Map();


function absoluteUrl(url, baseUrl) {

    try {
        return new URL(url, baseUrl).toString();
    } catch (_) {
        return "";
    }
}


function extractOgImage(html, pageUrl) {

    if (!html) {
        return "";
    }

    const patterns = [
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i,
        /<link[^>]+rel=["'][^"']*image_src[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i
    ];

    for (const pattern of patterns) {

        const match =
            html.match(pattern);

        if (match && match[1]) {

            const resolved =
                absoluteUrl(match[1], pageUrl);

            if (resolved) {
                return resolved;
            }
        }
    }

    return "";
}


async function resolveImageFromSources(phone) {

    const id =
        phone.slug ||
        phone.id ||
        phone.base_model_slug ||
        "";

    if (id && imageUrlCache.has(id)) {
        return imageUrlCache.get(id);
    }

    // 1. Known official product images first.
    const official = knownOfficialImage(phone);

    if (official) {
        if (id) imageUrlCache.set(id, official);
        return official;
    }

    // 2. Use a real direct image from the dataset only when it is
    // already an image URL. Do NOT mine source_urls for images.
    const direct = extractImageUrl(phone);

    const isProxyFallback =
        direct.startsWith(`${PUBLIC_BASE_URL}/api/phone-image/`);

    if (direct && !isProxyFallback && !isGenericWikipediaSource(direct)) {
        if (id) imageUrlCache.set(id, direct);
        return direct;
    }

    // 3. Exact model search on Wikipedia, not the generic source page.
    const wikipediaImage = await resolveImageFromWikipedia(phone);

    if (wikipediaImage) {
        if (id) imageUrlCache.set(id, wikipediaImage);
        return wikipediaImage;
    }

    // 4. As a last resort, try source pages only when they are not
    // generic "List of ..." pages. This prevents unrelated phone images.
    const sources =
        Array.isArray(phone.source_urls)
            ? phone.source_urls.filter(Boolean).slice(0, 3)
            : [];

    for (const sourceUrl of sources) {

        if (isGenericWikipediaSource(sourceUrl)) {
            continue;
        }

        try {

            const response = await fetch(sourceUrl, {
                redirect: "follow",
                headers: {
                    "User-Agent": "PhoneHub/1.0 (+image resolver)"
                },
                signal: AbortSignal.timeout(8000)
            });

            if (!response.ok) {
                continue;
            }

            const contentType =
                response.headers.get("content-type") || "";

            if (!contentType.includes("text/html")) {
                continue;
            }

            const html = await response.text();
            const imageUrl = extractOgImage(html, response.url || sourceUrl);

            if (imageUrl && !isGenericWikipediaSource(imageUrl)) {
                if (id) imageUrlCache.set(id, imageUrl);
                return imageUrl;
            }

        } catch (_) {
            // Continue.
        }
    }

    if (id) {
        imageUrlCache.set(id, "");
    }

    return "";
}


app.get(
    "/api/phone-image/:id",
    async (req, res) => {

        try {

            const requestedId =
                String(req.params.id || "").trim();

            if (!requestedId) {
                return res.status(400).send("Missing phone id");
            }

            const phones =
                await loadGetTechIndex();

            const phone =
                phones.find(item =>
                    String(
                        item.slug ||
                        item.id ||
                        item.base_model_slug ||
                        ""
                    ) === requestedId
                ) ||
                phones.find(item =>
                    String(item.name || "")
                        .toLowerCase() === requestedId.toLowerCase()
                );

            if (!phone) {
                return res.status(404).send("Phone not found");
            }

            const imageUrl =
                await resolveImageFromSources(phone);

            if (!imageUrl) {
                return res.status(404).send("Image not available");
            }

            return res.redirect(302, imageUrl);

        } catch (error) {

            console.log(
                "Phone image error:",
                error.message
            );

            return res.status(500).send("Image resolver error");
        }
    }
);


/* =========================================================
   API: LATEST PHONES
========================================================= */

app.get(
    "/api/latest",
    async (req, res) => {

        try {

            const phones =
                await loadGetTechIndex();

            const limit =
                Math.min(
                    Math.max(
                        parseInt(
                            req.query.limit || "20"
                        ),
                        1
                    ),
                    100
                );

            const sorted =
                [...phones]
                    .filter(
                        phone =>
                            phone.release_date
                    )
                    .sort(
                        (
                            a,
                            b
                        ) =>
                            String(
                                b.release_date
                            ).localeCompare(
                                String(
                                    a.release_date
                                )
                            )
                    )
                    .slice(
                        0,
                        limit
                    );

            res.json({

                success: true,

                provider:
                    "GetTechAPI",

                count:
                    sorted.length,

                data:
                    sorted

            });

        } catch (error) {

            console.log(
                "Latest error:",
                error.message
            );

            res.status(500).json({

                success: false,

                message:
                    error.message,

                data: []

            });
        }
    }
);


/* =========================================================
   API: TOP
   GETTECH LATEST DATA
========================================================= */

app.get(
    "/api/top",
    async (req, res) => {

        try {

            const phones =
                await loadGetTechIndex();

            const limit =
                Math.min(
                    Math.max(
                        parseInt(
                            req.query.limit || "20"
                        ),
                        1
                    ),
                    100
                );

            const latest =
                [...phones]
                    .filter(
                        phone =>
                            phone.release_date
                    )
                    .sort(
                        (
                            a,
                            b
                        ) =>
                            String(
                                b.release_date
                            ).localeCompare(
                                String(
                                    a.release_date
                                )
                            )
                    )
                    .slice(
                        0,
                        limit
                    );

            res.json({

                success: true,

                provider:
                    "GetTechAPI",

                count:
                    latest.length,

                data:
                    latest

            });

        } catch (error) {

            console.log(
                "Top API error:",
                error.message
            );

            res.status(500).json({

                success: false,

                message:
                    error.message,

                data: []

            });
        }
    }
);


/* =========================================================
   API: PHONES
========================================================= */

app.get(
    "/api/phones",
    async (req, res) => {

        try {

            const phones =
                await loadGetTechIndex();

            const limit =
                Math.min(
                    Math.max(
                        parseInt(
                            req.query.limit || "50"
                        ),
                        1
                    ),
                    500
                );

            res.json({

                success: true,

                provider:
                    "GetTechAPI",

                count:
                    phones.length,

                returned:
                    Math.min(
                        limit,
                        phones.length
                    ),

                data:
                    phones.slice(
                        0,
                        limit
                    )

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    error.message,

                data: []

            });
        }
    }
);


/* =========================================================
   API: SEARCH
========================================================= */

app.get(
    "/api/search",
    async (req, res) => {

        const query =
            String(
                req.query.q || ""
            )
            .trim()
            .toLowerCase();

        if (!query) {

            return res.json({

                success: true,

                provider:
                    "GetTechAPI",

                count: 0,

                data: []

            });
        }

        try {

            const phones =
                await loadGetTechIndex();

            const limit =
                Math.min(
                    Math.max(
                        parseInt(
                            req.query.limit || "50"
                        ),
                        1
                    ),
                    200
                );

            const results =
                phones
                    .filter(
                        phone => {

                            const name =
                                String(
                                    phone.name ||
                                    ""
                                ).toLowerCase();

                            const brand =
                                String(
                                    phone.brand ||
                                    ""
                                ).toLowerCase();

                            const id =
                                String(
                                    phone.id ||
                                    ""
                                ).toLowerCase();

                            return (
                                name.includes(query) ||
                                brand.includes(query) ||
                                id.includes(query)
                            );
                        }
                    )
                    .slice(
                        0,
                        limit
                    );

            res.json({

                success: true,

                provider:
                    "GetTechAPI",

                query:

                    query,

                count:

                    results.length,

                data:

                    results

            });

        } catch (error) {

            console.log(
                "Search error:",
                error.message
            );

            res.status(500).json({

                success: false,

                message:
                    error.message,

                data: []

            });
        }
    }
);


/* =========================================================
   API: PHONE DETAIL
========================================================= */

app.get(
    "/api/phone/:id",
    async (req, res) => {

        const id =
            String(
                req.params.id || ""
            ).toLowerCase();

        try {

            const phones =
                await loadGetTechIndex();

            const phone =
                phones.find(
                    item =>
                        String(
                            item.id
                        ).toLowerCase()
                        === id
                );

            if (!phone) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Phone not found",

                    data:
                        null

                });
            }

            res.json({

                success: true,

                provider:
                    "GetTechAPI",

                data:
                    phone

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    error.message

            });
        }
    }
);


/* =========================================================
   API: BRANDS
========================================================= */

app.get(
    "/api/brands",
    async (req, res) => {

        try {

            const phones =
                await loadGetTechIndex();

            const brandMap =
                new Map();

            for (
                const phone
                of phones
            ) {

                const brand =
                    phone.brand;

                if (!brand) {
                    continue;
                }

                if (
                    !brandMap.has(
                        brand
                    )
                ) {

                    brandMap.set(
                        brand,
                        0
                    );
                }

                brandMap.set(
                    brand,
                    brandMap.get(
                        brand
                    ) + 1
                );
            }

            const brands =
                [...brandMap.entries()]
                    .map(
                        (
                            [
                                name,
                                count
                            ]
                        ) => ({
                            name,
                            count
                        })
                    )
                    .sort(
                        (
                            a,
                            b
                        ) =>
                            a.name.localeCompare(
                                b.name
                            )
                    );

            res.json({

                success: true,

                provider:
                    "GetTechAPI",

                count:
                    brands.length,

                data:
                    brands

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    error.message,

                data: []

            });
        }
    }
);


/* =========================================================
   API: BRAND PHONES
========================================================= */

app.get(
    "/api/brand/:brand",
    async (req, res) => {

        try {

            const phones =
                await loadGetTechIndex();

            const brand =
                String(
                    req.params.brand || ""
                )
                .trim()
                .toLowerCase();

            const results =
                phones.filter(
                    phone =>
                        String(
                            phone.brand || ""
                        )
                        .toLowerCase()
                        === brand
                );

            res.json({

                success: true,

                provider:
                    "GetTechAPI",

                brand:
                    req.params.brand,

                count:
                    results.length,

                data:
                    results

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    error.message,

                data: []

            });
        }
    }
);


/* =========================================================
   API: UPCOMING 2027
========================================================= */

app.get(
    "/api/upcoming",
    async (req, res) => {

        try {

            /*
               If your manually created
               upcoming-2027.json exists,
               use it.
            */

            if (
                fs.existsSync(
                    UPCOMING_FILE
                )
            ) {

                const raw =
                    fs.readFileSync(
                        UPCOMING_FILE,
                        "utf8"
                    );

                const json =
                    JSON.parse(
                        raw
                    );

                const phones =
                    Array.isArray(
                        json.phones
                    )
                        ? json.phones
                        : Array.isArray(
                            json.data
                        )
                            ? json.data
                            : [];

                return res.json({

                    success: true,

                    provider:
                        "PhoneHub Upcoming Database",

                    year:
                        2027,

                    count:
                        phones.length,

                    data:
                        phones

                });
            }


            /*
               If the file does not exist,
               do NOT crash the server.
            */

            const phones =
                await loadGetTechIndex();

            const upcoming =
                phones.filter(
                    phone => {

                        const year =
                            parseInt(
                                phone.release_year
                            );

                        return (
                            year >= 2027
                        );
                    }
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        String(
                            a.release_date
                        ).localeCompare(
                            String(
                                b.release_date
                            )
                        )
                )
                .slice(
                    0,
                    100
                );

            res.json({

                success: true,

                provider:
                    "GetTechAPI",

                year:
                    2027,

                count:
                    upcoming.length,

                data:
                    upcoming

            });

        } catch (error) {

            console.log(
                "Upcoming error:",
                error.message
            );

            res.json({

                success: true,

                year:
                    2027,

                count: 0,

                data: []

            });
        }
    }
);


/* =========================================================
   API: SYNC
========================================================= */

app.get(
    "/api/sync",
    async (req, res) => {

        try {

            getTechPhones = [];

            getTechLoaded =
                false;

            getTechLoading =
                false;

            getTechLoadError =
                null;

            getTechLoadedAt =
                null;

            const phones =
                await loadGetTechIndex();

            res.json({

                success: true,

                provider:
                    "GetTechAPI",

                message:
                    "GetTech database reloaded successfully.",

                count:
                    phones.length

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    error.message

            });
        }
    }
);


/* =========================================================
   API: STATUS
========================================================= */

app.get(
    "/api/status",
    async (req, res) => {

        try {

            const indexExists =
                fs.existsSync(
                    GETTECH_INDEX_FILE
                );

            let indexSizeMB = 0;

            if (indexExists) {

                const stats =
                    fs.statSync(
                        GETTECH_INDEX_FILE
                    );

                indexSizeMB =
                    Number(
                        (
                            stats.size /
                            1024 /
                            1024
                        ).toFixed(2)
                    );
            }

            res.json({

                success: true,

                server:
                    "PhoneHub API Server",

                version:
                    "8.0.0",

                provider:
                    "GetTechAPI",

                source:
                    "Local GetTech smartphone dataset",

                indexExists:
                    indexExists,

                indexFile:
                    GETTECH_INDEX_FILE,

                indexSizeMB:
                    indexSizeMB,

                phoneCount:
                    getTechPhones.length,

                loaded:
                    getTechLoaded,

                loading:
                    getTechLoading,

                loadedAt:
                    getTechLoadedAt
                        ? getTechLoadedAt.toISOString()
                        : null,

                error:
                    getTechLoadError

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    error.message

            });
        }
    }
);


/* =========================================================
   HOME
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.send(`

            <!DOCTYPE html>

            <html>

            <head>

                <meta charset="UTF-8">

                <title>
                    PhoneHub API
                </title>

                <style>

                    body {
                        font-family:
                            Arial,
                            sans-serif;

                        background:
                            #f5f5f7;

                        padding:
                            40px;

                        color:
                            #151525;
                    }

                    .box {
                        max-width:
                            800px;

                        margin:
                            auto;

                        background:
                            white;

                        padding:
                            30px;

                        border-radius:
                            20px;

                        box-shadow:
                            0 10px 30px
                            rgba(
                                0,
                                0,
                                0,
                                0.08
                            );
                    }

                    h1 {
                        margin-top:
                            0;
                    }

                    a {
                        display:
                            block;

                        margin:
                            12px 0;

                        padding:
                            12px;

                        background:
                            #f0ebff;

                        border-radius:
                            10px;

                        color:
                            #6947ff;

                        text-decoration:
                            none;

                        font-weight:
                            bold;
                    }

                </style>

            </head>

            <body>

                <div class="box">

                    <h1>
                        ðŸ“± PhoneHub API
                    </h1>

                    <p>
                        GetTechAPI Local Database
                    </p>

                    <p>
                        92,824 smartphone records
                        indexed.
                    </p>

                    <hr>

                    <a href="/api/status">
                        /api/status
                    </a>

                    <a href="/api/gettech/status">
                        /api/gettech/status
                    </a>

                    <a href="/api/latest">
                        /api/latest
                    </a>

                    <a href="/api/phones">
                        /api/phones
                    </a>

                    <a href="/api/brands">
                        /api/brands
                    </a>

                    <a href="/api/upcoming">
                        /api/upcoming
                    </a>

                </div>

            </body>

            </html>

        `);
    }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    HOST,
    () => {

        console.log("");

        console.log(
            "=========================================="
        );

        console.log(
            "       PHONEHUB API SERVER 8.0"
        );

        console.log(
            "=========================================="
        );

        console.log(
            `Server: http://localhost:${PORT}`
        );

        console.log(
            `Network: http://0.0.0.0:${PORT}`
        );

        console.log(
            "Provider: GetTechAPI"
        );

        console.log(
            "Source: Local GetTech Dataset"
        );

        console.log(
            "Indexed records: 92,824"
        );

        console.log(
            "GSMArena: DISABLED"
        );

        console.log(
            "=========================================="
        );

        console.log("");

        /*
           Load database in background.
           Server starts immediately.
        */

        loadGetTechIndex()
            .catch(
                error => {

                    console.log(
                        "Background database load error:",
                        error.message
                    );

                }
            );
    }
);




