const fs = require("fs");
const path = require("path");

const SOURCE_DIR = "C:\\Users\\DELL\\TechAPI\\data\\smartphone";
const OUTPUT_FILE = path.join(
    __dirname,
    "data",
    "gettech-index.jsonl"
);

let processed = 0;
let success = 0;
let failed = 0;

function getJsonFiles(dir) {

    const result = [];

    const entries =
        fs.readdirSync(dir, {
            withFileTypes: true
        });

    for (const entry of entries) {

        const fullPath =
            path.join(
                dir,
                entry.name
            );

        if (entry.isDirectory()) {

            result.push(
                ...getJsonFiles(fullPath)
            );

        } else if (
            entry.isFile() &&
            entry.name.toLowerCase().endsWith(".json")
        ) {

            result.push(fullPath);
        }
    }

    return result;
}

async function main() {

    console.log("");
    console.log("==========================================");
    console.log("       PHONEHUB GETTECH INDEX BUILDER");
    console.log("==========================================");
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
        getJsonFiles(SOURCE_DIR);

    console.log(
        `Found ${files.length} JSON files.`
    );

    console.log("");
    console.log(
        "Building index..."
    );

    const output =
        fs.createWriteStream(
            OUTPUT_FILE,
            {
                encoding: "utf8"
            }
        );

    for (const file of files) {

        processed++;

        try {

            const raw =
                fs.readFileSync(
                    file,
                    "utf8"
                );

            const phone =
                JSON.parse(raw);

            const relativePath =
                path.relative(
                    SOURCE_DIR,
                    file
                );

            const record = {

                id:
                    phone.slug ||
                    path.basename(
                        file,
                        ".json"
                    ),

                name:
                    phone.name ||
                    "",

                brand:
                    phone.brand ||
                    "",

                release_date:
                    phone.release_date ||
                    "",

                verified:
                    phone.verified === true,

                file:
                    relativePath
            };

            output.write(
                JSON.stringify(record) +
                "\n"
            );

            success++;

        } catch (error) {

            failed++;

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
        resolve => output.end(resolve)
    );

    console.log("");
    console.log("==========================================");
    console.log("INDEX BUILD COMPLETE");
    console.log("==========================================");

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
}

main().catch(error => {

    console.error(
        "INDEX ERROR:",
        error
    );

    process.exit(1);
});