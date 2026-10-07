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
            return parts.join(" • ");
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

            formatDisplay(
                phone.display
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

            safeString(
                phone.image ||
                phone.img ||
                "",
                ""
            ),

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
                : []
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
                        📱 PhoneHub API
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





