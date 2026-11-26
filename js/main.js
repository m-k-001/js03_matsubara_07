// --------------------------------------------------
// 1. 外部ライブラリ（Three.js関連）の読み込み
// --------------------------------------------------

// 3Dを描画するための基本機能（本体）を読み込む
import * as THREE from
    "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

// マウスやタッチ操作でカメラを動かすためのプラグインを読み込む
import { OrbitControls } from
    "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";

// Blenderなどで作った「GLB / GLTF形式」の3Dモデルを読み込むためのローダーを読み込む
import { GLTFLoader } from
    "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";



// ==========================================
// 1. Three.js 基本セットアップ
// ==========================================

// $containerはただの変数  jQueryを使った変数と分かるように$をつけてる
const $container = $('#canvas-container');

// 3Dオブジェクトを配置する「世界（劇場）」を作る
const scene = new THREE.Scene();


// 視点となる「カメラ」を作る（人間の目に近い遠近感を持つレンズ）
// PerspectiveCamera(視野角, 縦横比, 最も近くに見える距離, 最も遠くまで見える距離)
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);

// カメラは通常、書かなくても描画するが、後でcamera.add(item.mesh)をするので必要、アイテムアップに使う
scene.add(camera);


// カメラ位置「カメラ自身をどこに置くか」 X, Y, Z座標 
camera.position.set(0, 1.8, 5);
// カメラ位置「そこからどこを見るか」 X, Y, Z座標 
camera.lookAt(0, 0.5, 0);

// 輪郭のギザギザを滑らかにする設定（綺麗に見える）
const renderer = new THREE.WebGLRenderer({ antialias: true });

// 🌟【リアル化設定①】現実のカメラのレンズを通したような美しい光の階調にする（トーンマッピング）
renderer.toneMapping = THREE.ACESFilmicToneMapping; // 映画のような色合いにする設定
renderer.toneMappingExposure = 1.0;                 // 画面の明るさ（露出）の調整

// 🌟【リアル化設定②】リアルな「影（シャドウ）」を計算するシステムをONにする
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 影の輪郭をぬるっとボカして綺麗にする

// 描画する画面サイズを、現在のブラウザの画面幅いっぱいに設定する
renderer.setSize(window.innerWidth, window.innerHeight);

// Three.jsが作成した3D描画用の画面を、HTMLの #canvas-container の中に埋め込む処理
$container.append(renderer.domElement);



// controls を定義する マウスで動かすため
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5, 0);
controls.enableDamping = true;


// ---------------------------------------------------
// 3. 照明（ライト）の配置
// -----------------------------------------------------

// ① 環境光（HemisphereLight）：上空と地面の2色から照らし、全体を自然に明るくする
// HemisphereLight(空の色, 地面の色, 光の強さ)
const ambientLight = new THREE.HemisphereLight(
    0xffffff,
    0x444444,
    0.5
);

scene.add(ambientLight);    // 劇場にライトを追加


// PointLight(光の色, 光の強さ, 光が届く距離, 減衰率) オムニライト
const pointLight = new THREE.PointLight(0xfff5e0, 30, 15, 2);

// ライトを置く座標（例：部屋の天井付近）
pointLight.position.set(0, 3.5, 2);

// 影を落とす設定 オムニライト影なし
pointLight.castShadow = false;

scene.add(pointLight);

// ライトの位置を視覚化するヘルパー（調整が終わったら消してOK）
// const pointLightHelper = new THREE.PointLightHelper(pointLight, 0.3);
// scene.add(pointLightHelper);


const spotLight = new THREE.SpotLight(0xfff5e0, 10, 15, Math.PI / 4);

spotLight.position.set(0, 3.5, 3);

spotLight.castShadow = true;
spotLight.shadow.mapSize.set(1024, 1024);
spotLight.shadow.bias = -0.0005;
spotLight.penumbra = 1.0;

scene.add(spotLight);




// 🌟【リアル化設定②】リアルな「影（シャドウ）」を計算するシステムをONにする
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 影の輪郭をぬるっとボカして綺麗にする





// --------------------------------------------------
// ・3Dモデル（GLBファイル）の読み込み
// ・机の引き出しを認識し配列に
// ・数字オブジェクトを認識し配列に
// ・ゲーム進行変数
// --------------------------------------------------

// ゲームの進行状態と正解の数字を管理する変数
// 'TITLE' 初期状態
// 'EXPLORE': 引き出しを開けてアイテムを探している段階
// 'SAVE_PROMPT' ゲーム進行をダイアログ表示中の状態にする
// 'SELECT_NUM': アイテムが3つ揃い、数字が出現して選べる段階
// 'FINISHED': クリアまたはゲームオーバーになり、操作を終了した段階
let gamePhase = '';

// 10個の数字オブジェクトを入れる入れる
const numbers = [];

// 6個の引き出しデータをまとめて入れる配列
const drawers = [];

// 引き出しの中身のデータを配列に
// inspectScaleは、拡大表示するときの大きさの倍率、アイテムアップのため必要
const items = [
    { name: 'lemon', drawerNum: 'desk_drawer_01', mesh: null, itemHas: false, label: 'レモン', inspectScale: 2.0 },
    { name: 'onion', drawerNum: 'desk_drawer_03', mesh: null, itemHas: false, label: 'たまねぎ', inspectScale: 2.0 },
    { name: 'apple', drawerNum: 'desk_drawer_05', mesh: null, itemHas: false, label: 'りんご', inspectScale: 2.0 }
];

// 取得した順番にアイテムの名前を配列に
const itemName = [];

//ゲーム指示、取得アイテム表示の関数
function updateItemList() {
    $("#message-text").empty();     //箱を空にする
    $("#message-text").append("<div>ROOM_01</div>");
    $("#message-text").append("<div>マウスホイール　拡大縮小</div>");
    $("#message-text").append("<div>マウスドラッグ　　　回転</div>");
    $("#message-text").append("<div>引き出しを調べる</div>");

    for (const name of itemName) {
        $("#message-text").append(`<div>${name}を取得</div>`);
    }
    if (itemName.length === items.length) {
        $("#message-text").append("<div>数字を1つ選択</div>");


    }
};

// アイテムアップのため、現在、画面中央で見せているアイテムを記憶するための変数
// constじゃだめ、配列は棚の中身（要素）を追加したり書き換えたりしているだけなのでconstでOK
let itemZoom = null;


const loader = new GLTFLoader();
loader.load(

    // ↓実際のファイル名を入力
    "./img/room01_wall_item.glb",

    (gltf) => {

        //読み込んだモデル本体（gltf.scene）に modelGroup という名前をつける
        const modelGroup = gltf.scene;


        // 「すべてのパーツ（部品）」を1つずつ点検して、見た目や影のルールを振り分ける処理
        // モデルの中に入っているすべての部品を、1つずつ child という名前で取り出して順番にチェック
        gltf.scene.traverse((child) => {
            // 取り出した部品が「形（3Dの面）を持った物体（メッシュ）」かどうかを確認
            if (child.isMesh) {
                // この部品（またはその親）の名前が hit_ で始まっているか調査、透明NULL板を探す
                if (child.name.startsWith('hit_') || (child.parent && child.parent.name.startsWith('hit_'))) {
                    // 他の場所に影を落とさない
                    child.castShadow = false;
                    // 自分自身にも影が映らない
                    child.receiveShadow = false;
                    // 完全に透明（不透明度ゼロ）な材質に塗り替え
                    child.material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
                } else {
                    child.castShadow = true;    // 自分が影を作る
                    child.receiveShadow = true; // 他の影が自分に映るようにする

                    // 🌟【追加】元の色やテクスチャを引き継ぎつつ、光と影が効く標準マテリアルに変換する
                    const oldMat = child.material;
                    child.material = new THREE.MeshStandardMaterial({
                        color: oldMat.color,
                        map: oldMat.map,
                        roughness: 0.8,
                        transparent: oldMat.transparent,
                        opacity: oldMat.opacity,

                    });
                }
            }

        });


        // 読み込んだモデルを画面に追加
        scene.add(gltf.scene);


        // ６個の引き出しを探して配列に登録する
        for (let i = 1; i <= 6; i++) {
            const obj = modelGroup.getObjectByName(`desk_drawer_0${i}`);
            // クリック判定用の透明NULL板を探す
            const hitObj = modelGroup.getObjectByName(`hit_0${i}`);
            if (obj) {
                drawers.push({
                    mesh: obj,                // 引き出しの3Dデータ
                    hitMesh: hitObj || obj,     // もし hitObj がなければ元の obj を使う
                    initialZ: obj.position.z, // 閉まっているときのZ座標
                    isOpen: false,             // 開閉状態（最初は全部閉）

                    name: `desk_drawer_0${i}`   // アイテム特定のための名前付け

                });
            }
        }

        console.log(`${drawers.length}個の引き出しを読み込みました！`);
        console.log(drawers);


        //引き出しの中のアイテムを取得 
        for (const item of items) {
            item.mesh = modelGroup.getObjectByName(item.name);
            // console.log(item.name, item.mesh);
        }


        // 10個の数字を探して配列に登録する
        for (let i = 0; i <= 9; i++) {
            const num_obj = modelGroup.getObjectByName(`num_0${i}`);
            if (num_obj) {
                numbers.push({
                    mesh: num_obj,       // 数字の3Dデータ
                    value: i,           // 判定しやすいように、0〜9の数字そのものを配列に
                    name: `num_0${i}`   // 特定のための名前付け
                });
                // オブジェクトを初期非表示
                // 注意、見えてないだけで、クリックには反応する
                num_obj.visible = false;
            }
        }
        console.log(`${numbers.length}個の数字を読み込みました！`);
        console.log(numbers);
    },
    undefined,  // 読み込み中の進捗（%など）は今回使わないので undefined
    (error) => {
        console.error("モデルの読み込みに失敗しました", error);
    }
);

console.log(`${items.length}個のアイテムを読み込みました！`);
console.log(items);


// ==========================================
// 3D空間クリックイベント
// ・引き出しのクリック判定
// ・アイテムのクリック判定
// ・数字のクリック判定
// ==========================================
// ▼ここから 3D空間でクリック判定（当たり判定）をしたいときに必ず書くお決まりの定型文的なもの
// とりあえず、画面のどこかをクリックしたら、処理をするという状態になる
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

$(window).on('click', function (event) {
    mouse.x = (event.clientX / $(window).width()) * 2 - 1;
    mouse.y = -(event.clientY / $(window).height()) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    // ▲ここまで定型文

    // まずは、今アイテムがズーム中かどうかのチェック
    if (itemZoom !== null) {    // 今、ズームしている最中だったら

        // アイテムを画面から消す。
        itemZoom.mesh.visible = false;
        // カメラの目の前から外す
        camera.remove(itemZoom.mesh);
        // アイテムを所有済みにして
        itemZoom.itemHas = true;
        // 配列に漢字の名前を入れる
        itemName.push(itemZoom.label);
        // 配列のアイテム名テキスト記入する関数を実行
        updateItemList();
        // カメラのマウス操作を復活させる。
        controls.enabled = true
        // 変数の初期化、重要忘れずに
        itemZoom = null;
        // アイテム名を消す
        $('#inspect-overlay').fadeOut(200);

        // 数字オブジェクトが出現させ、ゲーム進行状態を変数に入れる
        // 獲得アイテムと存在アイテムの数が一緒になったら
        if (itemName.length === items.length) {

            // 数字オブジェクトを出現させるために、配列をループ
            for (const number of numbers) {
                number.mesh.visible = true;    // 数字オブジェクトの初期非表示を解除
            }

            // カメラ操作を一時ロックして、ダイアログを画面中央に開く
            controls.enabled = false;
            gamePhase = 'SAVE_PROMPT'; // ゲーム進行をダイアログ表示中の状態にする

            // ダイアログ開く
            // showModal() で開くことで、背景の3D空間への誤クリックをブラウザが自動で防ぐ
            document.querySelector("#save-dialog").showModal(); // JSバニラ書き
            // jQueryで書くと→ $('#save-dialog')[0].showModal();

        }

        return;
    }

    // console.log(`${itemName.length}個のアイテムをゲット！`);
    // console.log(itemName);

    //ゲーム進行が FINISHEDなら、何もしない
    if (gamePhase === 'FINISHED') {
        return;
    }

    // 数字オブジェクトのクリック判定
    if (gamePhase === 'SELECT_NUM') {
        for (const number of numbers) {

            const numHits = raycaster.intersectObject(number.mesh, true);
            // number.mesh という特定の3Dオブジェクト（およびその中にあるパーツ）
            // に当たったかどうかを調べ、
            // 当たった結果のリストを numHits という変数に保存する」という意味

            if (numHits.length > 0) {
                // 「レーザーが number.mesh に当たった数（ヒット数）が 1つ以上ある」
                // つまり「number.mesh がクリックされた！」という意味
                gamePhase = 'FINISHED';
                controls.enabled = false;
                if (number.value === 5) {
                    $('#result-overlay').fadeIn(200);
                } else {
                    $('#gameover-overlay').fadeIn(200);
                }
            }
        }
        return;
    }




    // items配列から、１種類取り出しitemHasをチェック、phpのforearchと同じ
    for (const item of items) {
        if (item.itemHas === true) {
            continue;
        }
        // drawers配列の中から、アイテムの名前を見つける。.find便利なやつ
        const targetDrawer = drawers.find(d => d.name === item.drawerNum);
        if (targetDrawer.isOpen === true) {

            // 「括弧の中に指定した3Dモデルにレーザーがぶつかったか調べて！」クリックが当たっていたら
            const itemHits = raycaster.intersectObject(item.mesh, true);
            if (itemHits.length > 0) {
                // 変数にitemsから分けられたitemの配列部分をわたす
                itemZoom = item;
                // カメラが動くとダメなのでロック
                controls.enabled = false;
                // カメラの『持ち物（子要素）』としてくっつける命令
                // 引き出しから自動で切り離し、座標の基準（ゼロ地点）が「カメラの中心」に変わる
                // これで、Three.js 基本セットアップで書いたscene.add(camera)が活きる
                camera.add(item.mesh);
                // カメラの前の座標へ配置

                // マウスオーバーで色の変わったアイテムをもとにもどす
                // ifで安全に書く（hoveredMeshが存在する時だけ元に戻す）
                if (hoveredMesh && hoveredMesh.material && hoveredMesh.material.emissive) {
                    hoveredMesh.material.emissive.setHex(0x000000);
                    hoveredMesh.material.emissiveIntensity = 1.0; // 光の強さをもとに戻す
                    hoveredMesh = null;
                }


                item.mesh.position.set(0, 0, -0.6);
                // アイテム大きさ調整 配列では：inspectScale: 1.0としているが（X・Y・Zをまとめて1.0にしてる）
                // 実際の命令では、X・Y・Zの3方向の設定が必要
                item.mesh.scale.set(item.inspectScale, item.inspectScale, item.inspectScale);
                // アイテム名をHTMLに流し込む
                $("#inspect-title").text(item.label);
                $("#inspect-hint").text("画面クリックで閉じる");
                // アイテム名を出す
                $('#inspect-overlay').fadeIn(200);

                return;

            }
        }
    }


    // クリックされた場所を調べて、6個ある引き出しのうち『当たった1個だけ』の開閉スイッチを切り替えている処理
    for (let i = 0; i < drawers.length; i++) {
        const item = drawers[i]; // i番目の引き出しを取り出す
        // クリック判定用の透明NULL板のみにクリックが反応
        const hits = raycaster.intersectObject(item.hitMesh, true);
        if (hits.length > 0) {
            item.isOpen = !item.isOpen;
            break;
        }
    }

});


// ==========================================
// 2D空間クリックイベント ダイアログのセーブボタンイベント
// ==========================================

// セーブするで、ローカルストレージ用データの作成
$("#save-btn-yes").on("click", function (e) {

    e.stopPropagation(); // イベントのバブリング（クリック貫通）防止

    // ローカルストレージ用データをまとめる
    const data = {
        itemNames: itemName,

        openDrawers: drawers.filter(d => d.isOpen).map(d => d.name),
        // 命令をつなぎ合わせる書き方
        // .filter(...)	「開いているもの（isOpen === true）」だけ残す
        // .map(...)	中から「名前（name）」のラベルだけ剥がして集める
        // 結果こんな感じに['desk_drawer_01', 'desk_drawer_03']

        isReadyToSelect: true

    }
    // ローカルストレージへ、文字列化して、保存する
    localStorage.setItem('room01_save', JSON.stringify(data));

    // ダイアログを閉じる、注意バニラJSで
    document.querySelector("#save-dialog").close();
    // jQueryで書くと→ $('#save-dialog')[0].close();

    controls.enabled = true;    // カメラのマウス操作を復活させる。
    gamePhase = 'SELECT_NUM';   // 数字オブジェクトを選択する状態に
});


// セーブしない場合
$("#save-btn-no").on("click", function (e) {

    e.stopPropagation(); // イベントのバブリング（クリック貫通）防止

    document.querySelector("#save-dialog").close();
    controls.enabled = true;    // カメラのマウス操作を復活させる。
    gamePhase = 'SELECT_NUM';   // 数字オブジェクトを選択する状態に
});



// ==========================================
// クリックできるところで、マウスポインターを変える
// マウスオーバーでオブジェクトを光らせる
// ==========================================

// /★光用★ 前回光っていたオブジェクトを覚えておく変数（外れた時に戻すため）
let hoveredMesh = null;

$(window).on('mousemove', function (event) {

    // もしアイテムを拡大表示中なら
    if (itemZoom !== null) {
        // 全体のカーソル形状を指差しに切り替える。Three.jsなのでbodyに適応しないとダメ
        $('body').css('cursor', 'pointer');
        return;
    }

    //「探索中」でも「数字選択中」でもないとき（TITLE, SAVE_PROMPT, FINISHED）
    // → 裏の3D空間に反応させないため、カーソルを通常に戻してここで処理を終わる！
    if (gamePhase !== 'EXPLORE' && gamePhase !== 'SELECT_NUM') {
        $('body').css('cursor', 'default');
        return;
    }

    // 今クリックできる対象を入れる空の配列
    const targets = [];

    //現在のゲーム状態（gamePhase）によって、当たり判定に入れる対象を厳密に分ける
    if (gamePhase === 'EXPLORE') {
        // --- 探索中のときだけ、引き出しとアイテムを判定リストに入れる ---
        for (const drawer of drawers) {
            // 引き出しのNULL板を配列に入れる
            targets.push(drawer.hitMesh);
        }
        for (const item of items) {
            const targetDrawer = drawers.find(d => d.name === item.drawerNum);
            // まだ持っていない、かつ引き出しが開いているアイテム
            if (!item.itemHas && targetDrawer && targetDrawer.isOpen) {
                targets.push(item.mesh);
            }
        }
    } else if (gamePhase === 'SELECT_NUM') {
        // --- 数字選択中のときだけ、数字を判定リストに入れる ---
        for (const number of numbers) {     // 数字も追加
            // 念のため「画面に表示されている（visible === true）」ものだけを入れる          
            if (number.mesh && number.mesh.visible) {
                targets.push(number.mesh);
            }
        }
    }


    // ▼ここから定型文、マウス座標の変換
    mouse.x = (event.clientX / $(window).width()) * 2 - 1;
    mouse.y = -(event.clientY / $(window).height()) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    // ▲ここまで定型文

    const hits = raycaster.intersectObjects(targets, true);

    // ★光用★ まず前回光っていたものがあれば元の明るさに戻す
    if (hoveredMesh && hoveredMesh.material && hoveredMesh.material.emissive) {
        hoveredMesh.material.emissive.setHex(0x000000);
        hoveredMesh.material.emissiveIntensity = 1.0; // 光の強さをもとに戻す
        hoveredMesh = null;
    }

    // 何かヒットしていたらカーソルを変えて光らせる
    if (hits.length > 0) {
        $('body').css('cursor', 'pointer');     // ポインター変更

        // ★光用★ 一番手前に当たったメッシュを取得
        // 重要：[0] をつけて一番手前のオブジェクトを取得
        const hitObj = hits[0].object;

        // ★光用★ 透明な当たり判定用板（hitMesh）以外なら光らせる
        if (hitObj.material && hitObj.material.emissive && hitObj.visible) {
            hitObj.material.emissive.setHex(0x2979ff); // 鮮やかな青色に光らせる
            hitObj.material.emissiveIntensity = 3.0;  // 光の強さを2倍にする（さらに強くするなら 3.0 や 5.0）
            hoveredMesh = hitObj; // 光らせた対象を記憶
        }

    } else {
        $('body').css('cursor', 'default');
    }
});



// ==========================================
// 描画ループ＆リサイズ対応
// ==========================================
function animate() {
    requestAnimationFrame(animate);

    controls.update(); //マウスで動かすため これを追加（滑らかな動きを更新する）

    // 6個の引き出しの位置を毎フレーム更新する
    for (const item of drawers) {
        const targetZ = item.isOpen ? item.initialZ + 0.4 : item.initialZ;
        item.mesh.position.z += (targetZ - item.mesh.position.z) * 0.1;
    }

    // アイテムがアップになった時にゆっくり回転
    if (itemZoom !== null) {
        itemZoom.mesh.rotation.y += 0.02;
    }

    // 数字オブジェクトの回転
    if (gamePhase === "SELECT_NUM") {
        for (const number of numbers) {
            number.mesh.rotation.z += 0.01;
        }

    }

    renderer.render(scene, camera);
}
animate();

$(window).on('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==========================================
// ゲーム指示・取得アイテム履歴表示の関数
// ==========================================
updateItemList();

// ==========================================
// マウスで動くように
// ==========================================

// 床の下にカメラが潜り込まないようにする（上下の回転制限）
controls.maxPolarAngle = Math.PI / 2 - 0.05; // 床スレスレまでしか下がらない

// 部屋の壁の外までズームアウトしすぎないようにする（距離制限）
controls.minDistance = 1.5; // これ以上近づけない
controls.maxDistance = 5.0; // これ以上遠ざかれない

// 右ドラッグによる平行移動を禁止する（部屋の中心からズレるのを防ぐ）
controls.enablePan = false;




// ==========================================
// ゲームスタート設定
// ==========================================

// ゲーム進行初期状態
gamePhase = 'TITLE';

// 裏側の3D空間を勝手に操作できないようにロック
controls.enabled = false;

// セーブデータの有無チェック
const savedJson = localStorage.getItem('room01_save');

// もし,セーブデータがないなら、リプレイボタンを消す
if (savedJson === null) {
    $('#btn-retry').hide();
} else {
    $('#btn-retry').show(); // あるなら、リプレイボタンを出す
};

// 初めからゲームするとき
$("#btn-start").on("click", function (e) {

    e.stopPropagation(); // イベントのバブリング（クリック貫通）防止

    $('#title-screen').fadeOut(1000);    // タイトル画面を消し
    controls.enabled = true;    // ロック解除
    gamePhase = 'EXPLORE';  // ゲーム進行状態変更
});

// セーブデータを使ってゲームをするとき
$("#btn-retry").on("click", function (e) {

    e.stopPropagation(); // イベントのバブリング（クリック貫通）防止

    // JSON文字列をオブジェクトに戻す
    const saveData = JSON.parse(localStorage.getItem('room01_save'));

    // アイテムを一度、3D空間から消す
    for (const item of items) {
        item.itemHas = true;
        item.mesh.visible = false;
    }

    // 取得リスト（UI）を復元
    // 取得した順番にアイテムの名前を配列をリセット
    itemName.length = 0;
    // 保存していた ['檸檬', '玉葱', '林檎'] を順番通りに一気に入れる
    itemName.push(...saveData.itemNames);
    // 関数で、画面のテキストを更新
    updateItemList();

    // 開けっ放しにしていた引き出しを再現
    for (const drawer of drawers) {
        if (saveData.openDrawers.includes(drawer.name) === true) {
            drawer.isOpen = true;
        }
    }
    // includes()（インクルーズ） は、配列（または文字列）の中に
    // 「指定したデータが含まれているか？」を調べて、
    // true（ある） か false（ない） で答えてくれる命令

    // 数字オブジェクトを出現させる
    for (const number of numbers) {
        number.mesh.visible = true;
    }

    $('#title-screen').fadeOut(300);
    controls.enabled = true;
    gamePhase = 'SELECT_NUM';
});



// 正解からオープニングへ
$("#btn-to-title").on("click", function (e) {

    e.stopPropagation(); // イベントのバブリング（クリック貫通）防止

    localStorage.removeItem('room01_save'); location.reload();
});

// ゲームオーバーからオープニングへ
$("#btn-gameover-to-title").on("click", function (e) {

    e.stopPropagation(); // イベントのバブリング（クリック貫通）防止

    location.reload();
});