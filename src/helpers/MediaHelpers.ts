import { STATIC_FOLDER_PLACEHOLDER } from './../constants/StaticFolderPlaceholder';
import {
  decodeBase64,
  Extension,
  FrameworkDetector,
  MediaLibrary,
  Notifications,
  parseWinPath,
  Settings,
  Sorting
} from '.';
import { Dashboard } from '../commands/Dashboard';
import { Folders } from '../commands/Folders';
import {
  DEFAULT_CONTENT_TYPE,
  ExtensionState,
  HOME_PAGE_NAVIGATION_ID,
  SETTING_MEDIA_SUPPORTED_MIMETYPES
} from '../constants';
import { SortingOption } from '../dashboardWebView/models';
import { MediaInfo, MediaPaths, SortOrder, SortType } from '../models';
import { basename, join, parse, dirname, relative } from 'path';
import { statSync } from 'fs';
import { Uri, workspace, window, Position } from 'vscode';
import imageSize from 'image-size';
import { EditorHelper } from '@estruyf/vscode';
import { SortOption } from '../dashboardWebView/constants/SortOption';
import { DataListener, MediaListener } from '../listeners/panel';
import { ArticleHelper } from './ArticleHelper';
import { lookup } from 'mime-types';
import { existsAsync, readdirAsync, unlinkAsync, writeFileAsync } from '../utils';

export class MediaHelpers {
  private static media: MediaInfo[] = [];

  /**
   * Retrieve all media files
   * @param page
   * @param requestedFolder
   * @param sort
   * @returns
   */
  public static async getMedia(
    page: number = 0,
    requestedFolder: string = '',
    sort: SortingOption | null = null
  ) {
    const wsFolder = Folders.getWorkspaceFolder();
    const staticFolder = Folders.getStaticFolderRelativePath();
    const contentFolders = Folders.get();
    const viewData = Dashboard.viewData;
    let selectedFolder = requestedFolder;

    // Check if there are any content types that are set to use page bundles
    const contentTypes = ArticleHelper.getContentTypes();
    const pageBundleContentTypes = contentTypes.filter((ct) => ct.pageBundle);

    const ext = Extension.getInstance();
    const crntSort =
      sort === null
        ? await ext.getState<SortingOption | undefined>(
            ExtensionState.Dashboard.Media.Sorting,
            'workspace'
          )
        : sort;

    // If the static folder is not set, retreive the last opened location
    if (!selectedFolder) {
      const stateValue = await ext.getState<string | undefined>(
        ExtensionState.SelectedFolder,
        'workspace'
      );

      if (stateValue !== HOME_PAGE_NAVIGATION_ID) {
        // Support for page bundles
        if (
          viewData?.data?.filePath &&
          (viewData?.data?.filePath.endsWith('index.md') ||
            viewData?.data?.filePath.endsWith('index.mdx'))
        ) {
          const folderPath = parse(viewData.data.filePath).dir;
          selectedFolder = folderPath;
        } else if (stateValue && (await existsAsync(stateValue))) {
          selectedFolder = stateValue;
        }
      }
    }

    // Go to the home folder
    if (selectedFolder === HOME_PAGE_NAVIGATION_ID) {
      selectedFolder = '';
    }

    let relSelectedFolderPath = selectedFolder;
    const parsedPath = parseWinPath(wsFolder?.fsPath || '');
    if (selectedFolder && selectedFolder.startsWith(parsedPath)) {
      relSelectedFolderPath = selectedFolder.replace(parsedPath, '');
    }

    if (relSelectedFolderPath && relSelectedFolderPath.startsWith('/')) {
      relSelectedFolderPath = relSelectedFolderPath.substring(1);
    }

    let allMedia: MediaInfo[] = [];

    if (relSelectedFolderPath) {
      const files = await workspace.findFiles(join(relSelectedFolderPath, '/*'));
      const media = await MediaHelpers.updateMediaData(MediaHelpers.filterMedia(files));

      allMedia = [...media];
    } else {
      if (staticFolder && staticFolder !== STATIC_FOLDER_PLACEHOLDER.hexo.placeholder) {
        const folderSearch = join(staticFolder || '', '/*');
        const files = await workspace.findFiles(folderSearch);
        const media = await MediaHelpers.updateMediaData(MediaHelpers.filterMedia(files));

        allMedia = [...media];
      } else if (staticFolder && staticFolder === STATIC_FOLDER_PLACEHOLDER.hexo.placeholder) {
        const folderSearch = join(STATIC_FOLDER_PLACEHOLDER.hexo.postsFolder, '/*');
        const files = await workspace.findFiles(folderSearch);
        const media = await MediaHelpers.updateMediaData(MediaHelpers.filterMedia(files));

        allMedia = [...media];
      }

      if (pageBundleContentTypes.length > 0) {
        if (contentFolders && wsFolder) {
          for (let i = 0; i < contentFolders.length; i++) {
            const contentFolder = contentFolders[i];
            const relFolderPath = contentFolder.path.substring(wsFolder.fsPath.length + 1);
            const folderSearch = relSelectedFolderPath
              ? join(relSelectedFolderPath, '/*')
              : join(relFolderPath, '/*');
            const files = await workspace.findFiles(folderSearch);
            const media = await MediaHelpers.updateMediaData(MediaHelpers.filterMedia(files));

            allMedia = [...allMedia, ...media];
          }
        }
      }
    }

    MediaHelpers.media = Object.assign([], allMedia);
    let files: MediaInfo[] = MediaHelpers.media;

    // Retrieve the total after filtering and before the slicing happens
    const total = files.length;

    // Get media set
    files = files.map((file) => {
      try {
        const metadata = MediaLibrary.getInstance().get(file.fsPath);
        const mimeType = lookup(file.fsPath);

        return {
          ...file,
          dimensions:
            mimeType && mimeType.startsWith('image/') ? imageSize(file.fsPath) : undefined,
          mimeType: lookup(file.fsPath) || '',
          ...metadata
        };
      } catch (e) {
        return { ...file };
      }
    });
    files = files.filter((f) => f.mtime !== undefined);

    // Sort the files
    if (crntSort?.type === SortType.string) {
      if (crntSort.id === SortOption.AltAsc || crntSort.id === SortOption.AltDesc) {
        files = files.sort(Sorting.alphabetically('alt'));
      } else if (crntSort.id === SortOption.CaptionAsc || crntSort.id === SortOption.CaptionDesc) {
        files = files.sort(Sorting.alphabetically('caption'));
      } else {
        files = files.sort(Sorting.alphabetically('fsPath'));
      }
    } else if (
      crntSort?.type === SortType.number &&
      (crntSort?.id === SortOption.SizeAsc || crntSort?.id === SortOption.SizeDesc)
    ) {
      files = files.sort(Sorting.numerically('size'));
    } else if (crntSort?.type === SortType.date) {
      files = files.sort(Sorting.dateWithFallback('mtime', 'fsPath'));
    } else {
      files = files.sort(Sorting.alphabetically('fsPath'));
    }

    if (crntSort?.order === SortOrder.desc) {
      files = files.reverse();
    }

    // Retrieve all the folders
    let allContentFolders: string[] = [];
    let allFolders: string[] = [];

    let foldersFromSelection: string[] = [];

    if (selectedFolder) {
      if (await existsAsync(selectedFolder)) {
        foldersFromSelection = (await readdirAsync(selectedFolder, { withFileTypes: true }))
          .filter((dir) => dir.isDirectory())
          .map((dir) => parseWinPath(join(selectedFolder, dir.name)));
      }
    }

    // Retrieve all the content folders
    if (pageBundleContentTypes.length > 0) {
      for (const contentFolder of contentFolders) {
        const contentPath = contentFolder.path;
        if (contentPath && (await existsAsync(contentPath))) {
          const subFolders = (await readdirAsync(contentPath, { withFileTypes: true }))
            .filter((dir) => dir.isDirectory())
            .map((dir) => parseWinPath(join(contentPath, dir.name)));
          allContentFolders = [...allContentFolders, ...subFolders];
        }
      }
    }

    // Retrieve all the static folders
    let staticPath = join(parseWinPath(wsFolder?.fsPath || ''), staticFolder || '');
    if (staticFolder === STATIC_FOLDER_PLACEHOLDER.hexo.placeholder) {
      staticPath = join(
        parseWinPath(wsFolder?.fsPath || ''),
        STATIC_FOLDER_PLACEHOLDER.hexo.postsFolder
      );
    }

    if (staticPath && (await existsAsync(staticPath))) {
      allFolders = (await readdirAsync(staticPath, { withFileTypes: true }))
        .filter((dir) => dir.isDirectory())
        .map((dir) => parseWinPath(join(staticPath, dir.name)));
    }

    // Store the last opened folder
    await Extension.getInstance().setState(
      ExtensionState.SelectedFolder,
      requestedFolder === HOME_PAGE_NAVIGATION_ID ? HOME_PAGE_NAVIGATION_ID : selectedFolder,
      'workspace'
    );

    let sortedFolders = selectedFolder
      ? foldersFromSelection
      : [...allContentFolders, ...allFolders];

    sortedFolders = sortedFolders.sort((a, b) => {
      if (a.toLowerCase() < b.toLowerCase()) {
        return -1;
      }
      if (a.toLowerCase() > b.toLowerCase()) {
        return 1;
      }
      return 0;
    });

    if (crntSort?.order === SortOrder.desc) {
      sortedFolders = sortedFolders.reverse();
    }

    return {
      media: files,
      total: total,
      folders: sortedFolders,
      selectedFolder,
      allContentFolders,
      allStaticfolders: allFolders
    } as MediaPaths;
  }

  /**
   * Reset media array
   */
  public static resetMedia() {
    MediaHelpers.media = [];
  }

  /**
   * Save the dropped file in the current folder
   * @param fileData
   */
  public static async saveFile({
    fileName,
    contents,
    folder
  }: {
    fileName: string;
    contents: string;
    folder: string | null;
  }) {
    if (fileName && contents) {
      const wsFolder = Folders.getWorkspaceFolder();
      const staticFolder = Folders.getStaticFolderRelativePath();
      const wsPath = wsFolder ? wsFolder.fsPath : '';
      let absFolderPath = join(wsPath, staticFolder || '');

      if (folder) {
        absFolderPath = folder;
      }

      if (!(await existsAsync(absFolderPath))) {
        absFolderPath = join(wsPath, folder || '');
      }

      if (!(await existsAsync(absFolderPath))) {
        Notifications.error(`We couldn't find your selected folder.`);
        return;
      }

      const staticPath = join(absFolderPath, fileName);
      const imgData = decodeBase64(contents);

      if (imgData) {
        await writeFileAsync(staticPath, imgData.data);
        Notifications.info(`File ${fileName} uploaded to: ${folder}`);

        return true;
      } else {
        Notifications.error(`Something went wrong uploading ${fileName}`);
        throw new Error(`Something went wrong uploading ${fileName}`);
      }
    }

    return false;
  }

  /**
   * Delete the selected file
   * @param data
   * @returns
   */
  public static async deleteFile({
    file,
    page,
    folder
  }: {
    file: string;
    page: number;
    folder: string | null;
  }) {
    if (!file) {
      return;
    }

    try {
      await unlinkAsync(file);

      MediaHelpers.media = [];
      return true;
    } catch (err: any) {
      Notifications.error(`Something went wrong deleting ${basename(file)}`);
      throw new Error(`Something went wrong deleting ${basename(file)}`);
    }
  }

  /**
   * Insert an image into the front matter or contents
   * @param data
   */
  public static async insertMediaToMarkdown(data: any) {
    if (data?.file && data?.relPath) {
      await EditorHelper.showFile(data.file);
      Dashboard.resetViewData();

      const editor = window.activeTextEditor;
      if (!editor) {
        return;
      }

      const wsFolder = Folders.getWorkspaceFolder();
      const filePath = data.file;
      let relPath = data.relPath;

      const article = editor ? ArticleHelper.getFrontMatter(editor) : null;
      const articleCt =
        article && article.data ? ArticleHelper.getContentType(article.data) : DEFAULT_CONTENT_TYPE;

      const absImgPath = join(parseWinPath(wsFolder?.fsPath || ''), relPath);
      const fileDir = parseWinPath(dirname(filePath));
      const imgDir = parseWinPath(dirname(absImgPath));
      const contentFolders = Folders.get();

      // Check if relative paths need to be created for the media files
      if (articleCt.pageBundle) {
        // Check if image exists in one of the content folders
        const existsInContent = contentFolders.some((contentFolder) => {
          const contentPath = contentFolder.path;
          return imgDir.toLowerCase().indexOf(contentPath.toLowerCase()) !== -1;
        });

        // If the image exists in a content folder, the relative path needs to be used
        if (existsInContent) {
          const relImgPath = relative(fileDir, imgDir);

          relPath = join(relImgPath, basename(relPath));

          // Snippets are already parsed, so update the URL of the image
          if (data.snippet) {
            data.snippet = data.snippet.replace(
              data.relPath,
              FrameworkDetector.relAssetPathUpdate(relPath, editor.document.fileName)
            );
          }
        }
      }

      // Check if the image needs to be inserted in the content or front matter of the article
      if (data?.position) {
        const line = data.position.line;
        const character = data.position.character;
        if (line) {
          const selection = editor?.selection;
          await editor?.edit((builder) => {
            const mimeType = lookup(relPath);

            let isFile = true;
            if (mimeType) {
              isFile = !mimeType.startsWith('image');
            }

            const caption = isFile ? `${data.title || ''}` : `${data.alt || data.caption || ''}`;

            const snippet =
              data.snippet ||
              `${isFile ? '' : '!'}[${caption}](${FrameworkDetector.relAssetPathUpdate(
                relPath,
                editor.document.fileName
              ).replace(/ /g, '%20')})`;
            if (selection !== undefined) {
              builder.replace(selection, snippet);
            } else {
              builder.insert(new Position(line, character), snippet);
            }
          });
        }
        MediaListener.getMediaSelection();
      } else {
        MediaListener.getMediaSelection();

        DataListener.updateMetadata({
          field: data.fieldName,
          value: FrameworkDetector.relAssetPathUpdate(relPath, editor.document.fileName),
          parents: data.parents,
          blockData: data.blockData
        });
      }
    }
  }

  /**
   * Update the metadata of a media file
   * @param data
   */
  public static async updateMetadata(data: any) {
    const {
      file,
      filename,
      page,
      folder,
      ...metadata
    }: {
      file: string;
      filename: string;
      page: number;
      folder: string | null;
      metadata: any;
    } = data;

    const mediaLib = MediaLibrary.getInstance();
    mediaLib.set(file, metadata);

    // Check if filename needs to be updated
    await mediaLib.updateFilename(file, filename);
  }

  /**
   * Filter the media files
   */
  private static filterMedia(files: Uri[]) {
    let mimeTypes = Settings.get<string[]>(SETTING_MEDIA_SUPPORTED_MIMETYPES) || [
      'image/*',
      'video/*',
      'audio/*'
    ];
    mimeTypes = mimeTypes.map((type) => type.toLowerCase());

    return files
      .filter((file) => {
        const type = lookup(file.fsPath);
        if (type) {
          const isValid = this.acceptMimeType(type, mimeTypes);
          return isValid;
        }
        return false;
      })
      .map(
        (file) =>
          ({
            filename: basename(file.fsPath),
            fsPath: file.fsPath,
            vsPath: Dashboard.getWebview()?.asWebviewUri(file).toString(),
            stats: undefined
          } as MediaInfo)
      );
  }

  /**
   * Update the metadata of the retrieved files
   * @param files
   */
  private static async updateMediaData(files: MediaInfo[]) {
    files = files.map((m: MediaInfo) => {
      const stats = statSync(m.fsPath);
      return Object.assign({}, m, stats);
    });

    return Object.assign([], files);
  }

  /**
   * Validate mimetype of the selected file
   * @param crntType
   * @param supportedTypes
   * @returns
   */
  private static acceptMimeType(crntType: string, supportedTypes: string[]) {
    if (crntType && supportedTypes) {
      const mimeType = crntType.toLowerCase();
      const baseMimeType = mimeType.replace(/\/.*$/, '');

      return supportedTypes.some((type) => {
        const validType = type.trim().toLowerCase();
        if (validType.endsWith('/*')) {
          // This is something like a image/* mime type
          return baseMimeType === validType.replace(/\/.*$/, '');
        }
        return mimeType === validType;
      });
    }
    return true;
  }
}
