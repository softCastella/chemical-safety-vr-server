(function(global){
  'use strict';
  const chromeTop=65/966;
  const view=(key,label,screenId,image,overlayId=null)=>Object.freeze({key,label,screenId,overlayId,image,chromeTop});
  const web=Object.freeze([
    Object.freeze({label:'1열 · 타이틀',items:Object.freeze([
      view('title-bgm','BGM 선택','splash','assets/screens/title-bgm.png'),
      view('title','타이틀','title','assets/screens/title.png'),
      view('title-settings','타이틀 설정','title','assets/screens/title-settings.png','settings')
    ])}),
    Object.freeze({label:'2열 · 마을',items:Object.freeze([
      view('village','마을 보기','village','assets/screens/village.png'),
      view('village-missions','미션','village_missions','assets/screens/village-missions.png')
    ])}),
    Object.freeze({label:'3열 · 인트로',items:Object.freeze([
      view('opening-1','인트로 1','opening_1','assets/screens/opening-1.png'),
      view('opening-2','인트로 2','opening_2','assets/screens/opening-2.png'),
      view('opening-3','인트로 3','opening_3','assets/screens/opening-3.png')
    ])}),
    Object.freeze({label:'4열 · 퍼즐 선택',items:Object.freeze([
      view('difficulty','난이도','difficulty','assets/screens/difficulty.png'),
      view('stage-select','스테이지','stage_select','assets/screens/stage-select.png')
    ])}),
    Object.freeze({label:'5열 · 게임',items:Object.freeze([
      view('game','게임','game','assets/screens/game.png'),
      view('game-pause','일시정지','game','assets/screens/game-pause.png','pause'),
      view('game-retry','다시 풀기','game','assets/screens/game-retry.png','retry'),
      view('game-settings','게임 설정','game','assets/screens/game-settings.png','settings'),
      view('game-exit','게임 나가기','game','assets/screens/game-exit.png','exit')
    ])}),
    Object.freeze({label:'6열 · 데모 완료',items:Object.freeze([
      view('demo-complete','데모 플레이 끝','stage_select','assets/screens/demo-complete.png','demo_complete')
    ])})
  ]);
  global.STARLIGHT_SCREEN_CATALOGS=Object.freeze({
    web,
    android:Object.freeze([])
  });
  global.STARLIGHT_SCREEN_CATALOG=web;
})(window);
