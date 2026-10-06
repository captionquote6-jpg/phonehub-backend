const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const INDEX_FILE = path.join(
    __dirname,
    "data",
    "gettech-index.jsonl"
);

const TECH_API_ROOT =
    "C:\\Users\\DELL\\TechAPI\\data\\smartphone";


// ============================================================
// HELPERS
// ============================================================

function readIndex() {

    if (!fs.existsSync(INDEX_FILE)) {
        throw new Error(
            "GetTech index file not found."
        );
    }

    const content =
        fs.readFileSync(
            INDEX_FILE,
            "utf8"
        );

    if (!content.trim()) {
        return [];
    }

    return content
        .split(/\r?\n/)
        .filter(Boolean)
        .map(line => JSON.parse(line));
}


function readPhoneFile(relativePath) {

    const safeRelative =
        path.normalize(relativePath);

    const fullPath =
        path.join(
            TECH_API_ROOT,
            safeRelative
        );

    const root =
        path.resolve(TECH_API_ROOT);

    const resolved =
        path.resolve(fullPath);

    if (
        resolved !== root &&
        !resolved.startsWith(root + path.sep)
    ) {
        throw new Error(
            "Invalid phone file path."
        );
    }

    if (!fs.existsSync(resolved)) {
        throw new Error(
            "Phone data file not found."
        );
    }

    return JSON.parse(
        fs.readFileSync(
            resolved,
            "utf8"
        )
    );
}


function normalizePhone(phone) {

    return {

        id:
            phone.slug || "",

        name:
            phone.name || "",

        brand:
            phone.brand || "",

        release_date:
            phone.release_date || "",

        verified:
            phone.verified === true,

        soc:
            phone.soc || "",

        ram_gb:
            phone.ram_gb ?? null,

        battery_mah:
            phone.battery_mah ?? null,

        weight_g:
            phone.weight_g ?? null,

        os:
            phone.os || "",

        display:
            phone.display || {},

        source_urls:
            phone.source_urls || []

    };
}


// ============================================================
// GETTECH STATUS
// ============================================================

router.get(
    "/status",
    (req, res) => {

        try {

            const index =
                readIndex();

            const brands = [
                ...new Set(
                    index
                        .map(
                            item =>
                                String(
                                    item.brand || ""
                                ).trim()
                        )
                        .filter(Boolean)
                )
            ];

            res.json({

                success: true,

                source:
                    "GetTechAPI",

                records:
                    index.length,

                brands:
                    brands.length,

                index:
                    "READY"

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


// ============================================================
// GET ALL / PAGINATION
// ============================================================

router.get(
    "/phones",
    (req, res) => {

        try {

            const index =
                readIndex();

            const page =
                Math.max(
                    parseInt(
                        req.query.page || "1",
                        10
                    ),
                    1
                );

            const limit =
                Math.min(
                    Math.max(
                        parseInt(
                            req.query.limit || "50",
                            10
                        ),
                        1
                    ),
                    100
                );

            const start =
                (page - 1) * limit;

            const data =
                index.slice(
                    start,
                    start + limit
                );

            res.json({

                success: true,

                source:
                    "GetTechAPI",

                page,

                limit,

                total:
                    index.length,

                totalPages:
                    Math.ceil(
                        index.length / limit
                    ),

                count:
                    data.length,

                data

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


// ============================================================
// BRANDS
// ============================================================

router.get(
    "/brands",
    (req, res) => {

        try {

            const index =
                readIndex();

            const counts = {};

            for (
                const item of index
            ) {

                const brand =
                    String(
                        item.brand || ""
                    ).trim();

                if (!brand) {
                    continue;
                }

                const key =
                    brand.toLowerCase();

                if (!counts[key]) {

                    counts[key] = {

                        brand,

                        count: 0

                    };
                }

                counts[key].count++;
            }

            const brands =
                Object.values(counts)
                    .sort(
                        (a, b) =>
                            a.brand.localeCompare(
                                b.brand
                            )
                    );

            res.json({

                success: true,

                source:
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


// ============================================================
// PHONES BY BRAND
// ============================================================

router.get(
    "/brand/:brand",
    (req, res) => {

        try {

            const index =
                readIndex();

            const requestedBrand =
                decodeURIComponent(
                    req.params.brand
                )
                .trim()
                .toLowerCase();

            const page =
                Math.max(
                    parseInt(
                        req.query.page || "1",
                        10
                    ),
                    1
                );

            const limit =
                Math.min(
                    Math.max(
                        parseInt(
                            req.query.limit || "50",
                            10
                        ),
                        1
                    ),
                    100
                );

            const results =
                index.filter(
                    item =>
                        String(
                            item.brand || ""
                        )
                        .trim()
                        .toLowerCase() ===
                        requestedBrand
                );

            const start =
                (page - 1) * limit;

            const data =
                results.slice(
                    start,
                    start + limit
                );

            res.json({

                success: true,

                source:
                    "GetTechAPI",

                brand:
                    req.params.brand,

                page,

                limit,

                total:
                    results.length,

                totalPages:
                    Math.ceil(
                        results.length / limit
                    ),

                count:
                    data.length,

                data

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


// ============================================================
// SEARCH
// ============================================================

router.get(
    "/search",
    (req, res) => {

        try {

            const query =
                String(
                    req.query.q || ""
                )
                .trim()
                .toLowerCase();

            if (!query) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Search query is required.",

                    data: []

                });
            }

            const index =
                readIndex();

            const page =
                Math.max(
                    parseInt(
                        req.query.page || "1",
                        10
                    ),
                    1
                );

            const limit =
                Math.min(
                    Math.max(
                        parseInt(
                            req.query.limit || "50",
                            10
                        ),
                        1
                    ),
                    100
                );

            const results =
                index.filter(item => {

                    const name =
                        String(
                            item.name || ""
                        ).toLowerCase();

                    const brand =
                        String(
                            item.brand || ""
                        ).toLowerCase();

                    const id =
                        String(
                            item.id || ""
                        ).toLowerCase();

                    return (
                        name.includes(query) ||
                        brand.includes(query) ||
                        id.includes(query)
                    );
                });

            const start =
                (page - 1) * limit;

            const data =
                results.slice(
                    start,
                    start + limit
                );

            res.json({

                success: true,

                source:
                    "GetTechAPI",

                query,

                page,

                limit,

                total:
                    results.length,

                totalPages:
                    Math.ceil(
                        results.length / limit
                    ),

                count:
                    data.length,

                data

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


// ============================================================
// YEAR
// ============================================================

router.get(
    "/year/:year",
    (req, res) => {

        try {

            const year =
                String(
                    req.params.year
                );

            const index =
                readIndex();

            const page =
                Math.max(
                    parseInt(
                        req.query.page || "1",
                        10
                    ),
                    1
                );

            const limit =
                Math.min(
                    Math.max(
                        parseInt(
                            req.query.limit || "50",
                            10
                        ),
                        1
                    ),
                    100
                );

            const results =
                index.filter(item => {

                    const date =
                        String(
                            item.release_date || ""
                        );

                    return date.startsWith(
                        year
                    );
                });

            const start =
                (page - 1) * limit;

            const data =
                results.slice(
                    start,
                    start + limit
                );

            res.json({

                success: true,

                source:
                    "GetTechAPI",

                year,

                page,

                limit,

                total:
                    results.length,

                totalPages:
                    Math.ceil(
                        results.length / limit
                    ),

                count:
                    data.length,

                data

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


// ============================================================
// PHONE DETAIL
// ============================================================

router.get(
    "/phone/:id",
    (req, res) => {

        try {

            const id =
                decodeURIComponent(
                    req.params.id
                )
                .trim()
                .toLowerCase();

            const index =
                readIndex();

            const record =
                index.find(
                    item =>
                        String(
                            item.id || ""
                        )
                        .toLowerCase() === id
                );

            if (!record) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Phone not found.",

                    data: null

                });
            }

            const phone =
                readPhoneFile(
                    record.file
                );

            res.json({

                success: true,

                source:
                    "GetTechAPI",

                data:
                    normalizePhone(phone)

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    error.message,

                data: null

            });
        }
    }
);


// ============================================================
// ROUTER ERROR HANDLER
// ============================================================

router.use(
    (error, req, res, next) => {

        console.error(
            "GetTech API error:",
            error.message
        );

        res.status(500).json({

            success: false,

            message:
                error.message,

            data: []

        });
    }
);


module.exports = router;