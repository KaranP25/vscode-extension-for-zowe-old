/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import { IZoweTree, IZoweTreeNode } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { syncSessionNode } from "../utils/ProfilesUtils";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { returnIconState } from "./actions";
import * as contextually from "../shared/context";
import { ZoweLogger } from "../utils/ZoweLogger";
import { TreeViewUtils } from "../utils/TreeViewUtils";
import * as vscode from "vscode";

/**
 * View (DATA SETS, JOBS, USS) refresh button
 * Refreshes treeView and profiles including their validation setting
 *
 * @param {IZoweTree} treeProvider
 */
export async function refreshAll(treeProvider: IZoweTree<IZoweTreeNode>): Promise<void> {
    ZoweLogger.trace("refresh.refreshAll called.");
    await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
    for (const sessNode of treeProvider.mSessionNodes) {
        const profiles = await Profiles.getInstance().fetchAllProfiles();
        const found = profiles.some((prof) => prof.name === sessNode.label.toString().trim());
        if (found || sessNode.label.toString() === vscode.l10n.t("Favorites")) {
            if (contextually.isSessionNotFav(sessNode)) {
                sessNode.dirty = true;
                returnIconState(sessNode);
                syncSessionNode((profile) => ZoweExplorerApiRegister.getCommonApi(profile), sessNode);
            }
        } else {
            TreeViewUtils.removeSession(treeProvider, sessNode.label.toString().trim());
        }
    }
    treeProvider.refresh();
}
