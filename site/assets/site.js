/* 缝补生活官网交互：无依赖
   1) .js 类：CSS 据此让 .reveal 初始隐藏（JS 不可用时内容全可见）
   2) 移动端汉堡菜单
   3) IntersectionObserver 一次性滚动渐显
   4) 导航滚动阴影 + 年份填充 */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  /* 年份 */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* 导航滚动状态 */
  var nav = document.querySelector('.nav');
  var onScroll = function () {
    if (!nav) return;
    nav.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* 汉堡菜单：details 原生承担无 JS 展开，JS 仅做点锚点后自动收起 */
  var navDetails = document.querySelector('.nav__details');
  var mobileMenu = document.getElementById('mobileMenu');
  if (navDetails && mobileMenu) {
    mobileMenu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        navDetails.open = false;
      });
    });
  }

  /* 滚动渐显：进入视口一次后停止观察 */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          el.classList.add('in');
          io.unobserve(el);
          /* 入场动画结束即移除 class，变换不再压制卡片自身 hover */
          el.addEventListener('animationend', function () {
            el.classList.remove('reveal', 'in');
          }, { once: true });
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }
})();
