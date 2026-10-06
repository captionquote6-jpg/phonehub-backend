const fs = require("fs");
const path = require("path");

const SOURCE_DIR =
    "C:\\Users\\DELL\\TechAPI\\data\\smartphone";

const OUTPUT_FILE =
    path.join(
        __dirname,
        "data",
        "gettech-index.jsonl"
    );

let processed = 0;
let success = 0;
let failed = 0;


// ============================================================
// FIND ALL JSON FILES
// ============================================================

function getJsonFiles(dir) {

    const result = [];

    const entries =
        fs.readdirSync(
            dir,
            {
                withFileTypes: true
            }
        );

    for (const entry of entries) {

        const fullPath =
            path.join(
                dir,
                entry.name
            );

        if (entry.isDirectory()) {

            result.push(
                ...getJsonFiles(
                    fullPath
                )
            );

        } else if (
            entry.isFile() &&
            entry.name
                .toLowerCase()
                .endsWith(".json")
        ) {

            result.push(
                fullPath
            );
        }
    }

    return result;
}


// ============================================================
// SAFE VALUE
// ============================================================

function safeValue(
    value,
    fallback = ""
) {

    if (
        value === undefined ||
        value === null
    ) {

        return fallback;
    }

    if (
        typeof value === "string"
    ) {

        const trimmed =
            value.trim();

        return trimmed ||
            fallback;
    }

    return value;
}


// ============================================================
// NUMBER / ARRAY FORMAT
// ============================================================

function formatGb(
    value
) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";
    }

    if (
        Array.isArray(value)
    ) {

        return value
            .filter(
                item =>
                    item !== null &&
                    item !== undefined
            )
            .map(
                item =>
                    `${item} GB`
            )
            .join(" / ");
    }

    return `${value} GB`;
}


function formatMah(
    value
) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";
    }

    if (
        Array.isArray(value)
    ) {

        return value
            .filter(
                item =>
                    item !== null &&
                    item !== undefined
            )
            .map(
                item =>
                    `${item} mAh`
            )
            .join(" / ");
    }

    return `${value} mAh`;
}


// ============================================================
// DISPLAY
// ============================================================

function formatDisplay(
    display
) {

    if (
        display === undefined ||
        display === null
    ) {

        return "";
    }

    if (
        typeof display === "string"
    ) {

        return display.trim();
    }

    if (
        typeof display === "object"
    ) {

        const size =
            safeValue(
                display.size_inch ||
                display.size ||
                display.screen_size,
                ""
            );

        const resolution =
            safeValue(
                display.resolution,
                ""
            );

        const type =
            safeValue(
                display.type ||
                display.panel ||
                display.technology,
                ""
            );

        const refreshRate =
            safeValue(
                display.refresh_rate ||
                display.refreshRate,
                ""
            );

        const parts = [];

        if (size) {

            parts.push(
                `${size}"`
            );
        }

        if (resolution) {

            parts.push(
                resolution
            );
        }

        if (type) {

            parts.push(
                type
            );
        }

        if (refreshRate) {

            parts.push(
                `${refreshRate}Hz`
            );
        }

        return parts.join(
            " • "
        );
    }

    return String(
        display
    );
}


// ============================================================
// CAMERA
// ============================================================

function formatCamera(
    phone
) {

    if (
        phone.camera
    ) {

        if (
            typeof phone.camera ===
            "string"
        ) {

            return phone.camera;
        }

        if (
            typeof phone.camera ===
            "object"
        ) {

            return JSON.stringify(
                phone.camera
            );
        }
    }

    if (
        phone.main_camera
    ) {

        if (
            typeof phone.main_camera ===
            "string"
        ) {

            return phone.main_camera;
        }

        return JSON.stringify(
            phone.main_camera
        );
    }

    if (
        phone.rear_camera
    ) {

        if (
            typeof phone.rear_camera ===
            "string"
        ) {

            return phone.rear_camera;
        }

        return JSON.stringify(
            phone.rear_camera
        );
    }

    return "";
}


// ============================================================
// PROCESSOR
// ============================================================

function formatProcessor(
    phone
) {

    return safeValue(
        phone.soc ||
        phone.chipset ||
        phone.processor ||
        phone.cpu,
        ""
    );
}


// ============================================================
// RAM
// ============================================================

function formatRam(
    phone
) {

    if (
        phone.ram_gb !== undefined &&
        phone.ram_gb !== null
    ) {

        return formatGb(
            phone.ram_gb
        );
    }

    if (
        phone.ram !== undefined &&
        phone.ram !== null
    ) {

        return safeValue(
            phone.ram
        );
    }

    if (
        phone.memory !== undefined &&
        phone.memory !== null
    ) {

        return safeValue(
            phone.memory
        );
    }

    return "";
}


// ============================================================
// STORAGE
// ============================================================

function formatStorage(
    phone
) {

    if (
        phone.storage_options_gb !==
        undefined &&
        phone.storage_options_gb !==
        null
    ) {

        return formatGb(
            phone.storage_options_gb
        );
    }

    if (
        phone.storage_gb !==
        undefined &&
        phone.storage_gb !==
        null
    ) {

        return formatGb(
            phone.storage_gb
        );
    }

    if (
        phone.storage !==
        undefined &&
        phone.storage !==
        null
    ) {

        return safeValue(
            phone.storage
        );
    }

    if (
        phone.internal_storage !==
        undefined &&
        phone.internal_storage !==
        null
    ) {

        return safeValue(
            phone.internal_storage
        );
    }

    if (
        phone.rom !==
        undefined &&
        phone.rom !==
        null
    ) {

        return safeValue(
            phone.rom
        );
    }

    return "";
}


// ============================================================
// BATTERY
// ============================================================

function formatBattery(
    phone
) {

    if (
        phone.battery_mah !==
        undefined &&
        phone.battery_mah !==
        null
    ) {

        return formatMah(
            phone.battery_mah
        );
    }

    if (
        phone.battery !==
        undefined &&
        phone.battery !==
        null
    ) {

        return safeValue(
            phone.battery
        );
    }

    if (
        phone.battery_capacity !==
        undefined &&
        phone.battery_capacity !==
        null
    ) {

        return formatMah(
            phone.battery_capacity
        );
    }

    return "";
}


// ============================================================
// OPERATING SYSTEM
// ============================================================

function formatOs(
    phone
) {

    const os =
        safeValue(
            phone.os,
            ""
        );

    const version =
        safeValue(
            phone.os_version,
            ""
        );

    if (
        os &&
        version
    ) {

        return `${os} ${version}`;
    }

    if (os) {

        return os;
    }

    if (version) {

        return version;
    }

    return "";
}


// ============================================================
// WEIGHT
// ============================================================

function formatWeight(
    phone
) {

    if (
        phone.weight_g !==
        undefined &&
        phone.weight_g !==
        null
    ) {

        return `${phone.weight_g} g`;
    }

    if (
        phone.weight !==
        undefined &&
        phone.weight !==
        null
    ) {

        return safeValue(
            phone.weight
        );
    }

    return "";
}


// ============================================================
// SOURCE URLS
// ============================================================

function formatSourceUrls(
    phone
) {

    if (
        Array.isArray(
            phone.source_urls
        )
    ) {

        return phone.source_urls;
    }

    if (
        Array.isArray(
            phone.sources
        )
    ) {

        return phone.sources;
    }

    return [];
}


// ============================================================
// CREATE INDEX RECORD
// ============================================================

function createRecord(
    phone,
    file
) {

    const relativePath =
        path.relative(
            SOURCE_DIR,
            file
        );

    const releaseDate =
        safeValue(
            phone.release_date ||
            phone.releaseDate,
            ""
        );

    const record = {

        // ----------------------------------------------------
        // BASIC
        // ----------------------------------------------------

        id:
            safeValue(
                phone.slug ||
                phone.id ||
                phone.base_model_slug ||
                path.basename(
                    file,
                    ".json"
                )
            ),

        slug:
            safeValue(
                phone.slug ||
                phone.id ||
                phone.base_model_slug,
                ""
            ),

        base_model_slug:
            safeValue(
                phone.base_model_slug,
                ""
            ),

        name:
            safeValue(
                phone.name ||
                phone.model ||
                phone.title,
                ""
            ),

        brand:
            safeValue(
                phone.brand ||
                phone.manufacturer,
                ""
            ),

        category:
            safeValue(
                phone.category,
                "Smartphone"
            ),

        // ----------------------------------------------------
        // PRICE
        // ----------------------------------------------------

        price:
            safeValue(
                phone.price,
                "-"
            ),

        // ----------------------------------------------------
        // DISPLAY
        // ----------------------------------------------------

        display:
            formatDisplay(
                phone.display
            ),

        // ----------------------------------------------------
        // PROCESSOR
        // ----------------------------------------------------

        processor:
            formatProcessor(
                phone
            ),

        soc:
            safeValue(
                phone.soc,
                ""
            ),

        chipset:
            safeValue(
                phone.chipset,
                ""
            ),

        // ----------------------------------------------------
        // RAM
        // ----------------------------------------------------

        ram:
            formatRam(
                phone
            ),

        ram_gb:
            phone.ram_gb !== undefined
                ? phone.ram_gb
                : null,

        // ----------------------------------------------------
        // STORAGE
        // ----------------------------------------------------

        storage:
            formatStorage(
                phone
            ),

        storage_gb:
            phone.storage_gb !== undefined
                ? phone.storage_gb
                : null,

        storage_options_gb:
            Array.isArray(
                phone.storage_options_gb
            )
                ? phone.storage_options_gb
                : [],

        // ----------------------------------------------------
        // CAMERA
        // ----------------------------------------------------

        camera:
            formatCamera(
                phone
            ),

        main_camera:
            phone.main_camera !== undefined
                ? phone.main_camera
                : null,

        rear_camera:
            phone.rear_camera !== undefined
                ? phone.rear_camera
                : null,

        // ----------------------------------------------------
        // BATTERY
        // ----------------------------------------------------

        battery:
            formatBattery(
                phone
            ),

        battery_mah:
            phone.battery_mah !== undefined
                ? phone.battery_mah
                : null,

        // ----------------------------------------------------
        // SOFTWARE
        // ----------------------------------------------------

        os:
            formatOs(
                phone
            ),

        os_name:
            safeValue(
                phone.os,
                ""
            ),

        os_version:
            safeValue(
                phone.os_version,
                ""
            ),

        // ----------------------------------------------------
        // DESIGN
        // ----------------------------------------------------

        weight:
            formatWeight(
                phone
            ),

        weight_g:
            phone.weight_g !== undefined
                ? phone.weight_g
                : null,

        // ----------------------------------------------------
        // RELEASE
        // ----------------------------------------------------

        release_date:
            releaseDate,

        release_year:
            releaseDate
                ? String(
                    releaseDate
                ).substring(
                    0,
                    4
                )
                : "",

        // ----------------------------------------------------
        // VERIFICATION
        // ----------------------------------------------------

        verified:
            phone.verified === true,

        // ----------------------------------------------------
        // IMAGE
        // ----------------------------------------------------

        image:
            safeValue(
                phone.image ||
                phone.img,
                ""
            ),

        // ----------------------------------------------------
        // SOURCE
        // ----------------------------------------------------

        source_urls:
            formatSourceUrls(
                phone
            ),

        // ----------------------------------------------------
        // FILE
        // ----------------------------------------------------

        file:
            relativePath,

        // ----------------------------------------------------
        // RAW ORIGINAL DATA
        // ----------------------------------------------------

        raw:
            phone
    };

    return record;
}


// ============================================================
// MAIN
// ============================================================

async function main() {

    console.log("");

    console.log(
        "=========================================="
    );

    console.log(
        "       PHONEHUB GETTECH INDEX BUILDER"
    );

    console.log(
        "=========================================="
    );

    console.log("");

    console.log(
        "Source:",
        SOURCE_DIR
    );

    console.log(
        "Output:",
        OUTPUT_FILE
    );

    console.log("");

    console.log(
        "Finding smartphone JSON files..."
    );

    const files =
        getJsonFiles(
            SOURCE_DIR
        );

    console.log(
        `Found ${files.length} JSON files.`
    );

    console.log("");

    // --------------------------------------------------------
    // CREATE DATA DIRECTORY
    // --------------------------------------------------------

    fs.mkdirSync(
        path.dirname(
            OUTPUT_FILE
        ),
        {
            recursive: true
        }
    );

    // --------------------------------------------------------
    // REMOVE OLD INDEX
    // --------------------------------------------------------

    if (
        fs.existsSync(
            OUTPUT_FILE
        )
    ) {

        fs.unlinkSync(
            OUTPUT_FILE
        );

        console.log(
            "Old index removed."
        );
    }

    console.log("");

    console.log(
        "Building new index..."
    );

    console.log("");

    const output =
        fs.createWriteStream(
            OUTPUT_FILE,
            {
                encoding: "utf8"
            }
        );

    for (
        const file
        of files
    ) {

        processed++;

        try {

            const raw =
                fs.readFileSync(
                    file,
                    "utf8"
                );

            const phone =
                JSON.parse(
                    raw
                );

            const record =
                createRecord(
                    phone,
                    file
                );

            output.write(
                JSON.stringify(
                    record
                ) +
                "\n"
            );

            success++;

        } catch (
            error
        ) {

            failed++;

            console.error(
                "FAILED:",
                file
            );

            console.error(
                error.message
            );
        }

        if (
            processed % 1000 === 0
        ) {

            console.log(
                `Processed: ${processed}/${files.length} | Success: ${success} | Failed: ${failed}`
            );
        }
    }

    await new Promise(
        resolve =>
            output.end(
                resolve
            )
    );

    console.log("");

    console.log(
        "=========================================="
    );

    console.log(
        "INDEX BUILD COMPLETE"
    );

    console.log(
        "=========================================="
    );

    console.log(
        "Processed:",
        processed
    );

    console.log(
        "Success:",
        success
    );

    console.log(
        "Failed:",
        failed
    );

    console.log(
        "Index file:",
        OUTPUT_FILE
    );

    console.log("");

    console.log(
        "New fields included:"
    );

    console.log(
        "Processor / SoC"
    );

    console.log(
        "RAM"
    );

    console.log(
        "Storage"
    );

    console.log(
        "Battery"
    );

    console.log(
        "OS + OS Version"
    );

    console.log(
        "Display"
    );

    console.log(
        "Camera"
    );

    console.log(
        "Weight"
    );

    console.log(
        "Release Date"
    );

    console.log(
        "Source URLs"
    );

    console.log(
        "Original RAW JSON"
    );

    console.log("");
}


// ============================================================
// ERROR HANDLER
// ============================================================

main().catch(
    error => {

        console.error(
            "INDEX ERROR:",
            error
        );

        process.exit(1);
    }
);