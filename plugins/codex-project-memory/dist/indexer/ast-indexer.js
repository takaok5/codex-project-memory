import { Node, Project } from "ts-morph";
import { hashContent } from "./hash.js";
import { inferNestRoutes } from "./route-indexer.js";
export function indexFileAst(absPath, file, options) {
    const indexedFile = {
        path: file.path,
        language: file.language,
        moduleId: options.moduleId,
        hash: file.hash,
        sizeBytes: file.sizeBytes,
        lineCount: 0,
        isTest: file.isTest,
        isGenerated: file.isGenerated,
        lastIndexedAt: new Date().toISOString()
    };
    try {
        const project = new Project({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
        const sourceFile = project.addSourceFileAtPath(absPath);
        indexedFile.lineCount = sourceFile.getFullText().split(/\r?\n/).length;
        const symbols = extractSymbolsFromSourceFile(sourceFile, options.fileId);
        const imports = extractImportExportEdges(sourceFile);
        const routes = inferNestRoutes(sourceFile, symbols).map((route) => ({ ...route, moduleId: options.moduleId ?? undefined }));
        return { file: indexedFile, symbols, imports, routes, testLinks: [], warnings: [] };
    }
    catch (error) {
        const warning = {
            warningType: "parse_error",
            severity: "warning",
            moduleId: options.moduleId ?? undefined,
            fileId: options.fileId,
            message: `Failed to parse ${file.path}: ${error instanceof Error ? error.message : "unknown"}`,
            source: "parser",
            confidence: 1
        };
        return { file: indexedFile, symbols: [], imports: [], routes: [], testLinks: [], warnings: [warning] };
    }
}
export function extractSymbolsFromSourceFile(sourceFile, fileIdHint = 0) {
    const symbols = [];
    for (const cls of sourceFile.getClasses()) {
        const name = cls.getName();
        if (!name)
            continue;
        const exported = cls.isExported();
        symbols.push(makeSymbol(fileIdHint, name, name, classKind(name), exported, cls));
        for (const method of cls.getMethods()) {
            symbols.push(makeSymbol(fileIdHint, `${name}.${method.getName()}`, method.getName(), "method", exported, method));
        }
    }
    for (const item of sourceFile.getInterfaces()) {
        const name = item.getName();
        symbols.push(makeSymbol(fileIdHint, name, name, "interface", item.isExported(), item));
    }
    for (const item of sourceFile.getTypeAliases()) {
        const name = item.getName();
        symbols.push(makeSymbol(fileIdHint, name, name, "type", item.isExported(), item));
    }
    for (const item of sourceFile.getEnums()) {
        const name = item.getName();
        symbols.push(makeSymbol(fileIdHint, name, name, "enum", item.isExported(), item));
    }
    for (const item of sourceFile.getFunctions()) {
        const name = item.getName();
        if (name)
            symbols.push(makeSymbol(fileIdHint, name, name, "function", item.isExported(), item));
    }
    for (const statement of sourceFile.getVariableStatements()) {
        if (!statement.isExported())
            continue;
        for (const declaration of statement.getDeclarations()) {
            const name = declaration.getName();
            symbols.push(makeSymbol(fileIdHint, name, name, "const", true, declaration));
        }
    }
    return symbols.sort((a, b) => a.fqName.localeCompare(b.fqName));
}
export function extractImportExportEdges(sourceFile) {
    const edges = [];
    for (const declaration of sourceFile.getImportDeclarations()) {
        const sourceModule = declaration.getModuleSpecifierValue();
        const names = [
            ...declaration.getNamedImports().map((item) => item.getName()),
            declaration.getDefaultImport()?.getText(),
            declaration.getNamespaceImport()?.getText()
        ].filter((value) => Boolean(value));
        for (const importedName of names) {
            edges.push({ importedName, sourceModule, edgeKind: "import", resolved: false });
        }
    }
    for (const declaration of sourceFile.getExportDeclarations()) {
        const sourceModule = declaration.getModuleSpecifierValue();
        if (!sourceModule)
            continue;
        for (const namedExport of declaration.getNamedExports()) {
            edges.push({ importedName: namedExport.getName(), sourceModule, edgeKind: "export", resolved: false });
        }
    }
    return edges;
}
function classKind(name) {
    if (name.endsWith("Service"))
        return "service";
    if (name.endsWith("Controller"))
        return "controller";
    if (name.endsWith("Repository"))
        return "repository";
    return "class";
}
function makeSymbol(fileId, fqName, name, kind, exported, node) {
    const signature = signatureText(node);
    return {
        fileId,
        fqName,
        name,
        kind,
        exported,
        startLine: node.getStartLineNumber(),
        endLine: node.getEndLineNumber(),
        signature,
        signatureHash: hashContent(signature),
        bodyHash: hashContent(node.getText().replace(/\s+/g, " ").trim())
    };
}
function signatureText(node) {
    if (Node.isClassDeclaration(node)) {
        return stripBody(node);
    }
    if (Node.isMethodDeclaration(node)) {
        return node.getText().replace(/\{[\s\S]*$/, "").replace(/\s+/g, " ").trim().slice(0, 500);
    }
    return node.getText().replace(/\s+/g, " ").trim().slice(0, 500);
}
function stripBody(node) {
    return `export class ${node.getName() ?? "Anonymous"}`.replace(/\s+/g, " ").trim();
}
//# sourceMappingURL=ast-indexer.js.map