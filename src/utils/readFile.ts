// fs/promises code to read a file and return its contents as a string
import fs from "fs/promises";
const read = async ( path: string ): Promise<string> => {
    const file = await fs.readFile(path, "utf-8");
    return file;
}

export { read };