/**
 * 阿吾勒 · 移动端落地页交互
 * 无依赖，兼容微信内置浏览器 / iOS Safari / Android Chrome
 */
(function () {
  "use strict";

  var CONFIG = Object.assign(
    {
      brand: "阿吾勒",
      wechat: "AUL-ILI",
      phone: "",
      apiBase: "",
      demoMode: false,
      share: {
        title: "去伊犁，做几天牧人",
        text: "住进哈萨克牧民的夏牧场：挤奶、骑马、赶羊、打馕。5天4晚，¥4,680/人起，每期仅8人。",
        url: window.location.href
      }
    },
    window.AUL_CONFIG || {}
  );

  var $ = function (selector, root) {
    return (root || document).querySelector(selector);
  };
  var $$ = function (selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  };
  var isWechat = /MicroMessenger/i.test(navigator.userAgent);
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.documentElement.classList.add("js");

  /* ---------------- 基础内容替换 ---------------- */

  $$("[data-wechat-text]").forEach(function (el) {
    el.textContent = CONFIG.wechat;
  });

  $$("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  if (CONFIG.demoMode) {
    document.body.classList.add("is-demo");
    $$("[data-demo-chip], [data-demo-footer]").forEach(function (el) {
      el.hidden = false;
    });
  }

  /* ---------------- 滚动 / 顶部栏 / 悬浮条 ---------------- */

  var header = $(".site-header");
  var stickyBar = $("#stickyBar");
  var ticking = false;

  function updateOnScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle("is-scrolled", y > 36);
    if (stickyBar) {
      var visible = y > Math.min(520, window.innerHeight * 0.72);
      if (document.body.classList.contains("modal-open")) visible = false;
      stickyBar.classList.toggle("is-visible", visible);
      stickyBar.setAttribute("aria-hidden", visible ? "false" : "true");
    }
    ticking = false;
  }

  function requestScrollUpdate() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateOnScroll);
    }
  }

  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate);
  updateOnScroll();

  /* ---------------- 入场动画 ---------------- */

  var revealItems = $$(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    revealItems.forEach(function (item) {
      revealObserver.observe(item);
    });
    // 兜底：脚本异常或浏览器不支持时，内容不能一直隐藏
    window.setTimeout(function () {
      revealItems.forEach(function (item) {
        item.classList.add("is-visible");
      });
    }, 6000);
  } else {
    revealItems.forEach(function (item) {
      item.classList.add("is-visible");
    });
  }

  /* ---------------- 报名弹窗 ---------------- */

  var modal = $("#bookingModal");
  var panel = modal ? $(".modal-panel", modal) : null;
  var form = $("#bookingForm");
  var lastFocused = null;
  var currentStep = 1;
  var isSubmitting = false;
  var toastTimer = null;
  var successTitleEl = $("#successTitle");
  var successKickerEl = $("[data-success-kicker]");
  var successTextEl = $("[data-success-text]");
  var demoNoteEl = $("[data-demo-note]");
  var demoCopyButton = $("[data-copy-booking-success]");
  var successTitleDefault = successTitleEl ? successTitleEl.innerHTML : "";
  var successKickerDefault = successKickerEl ? successKickerEl.textContent : "";
  var successTextDefault = successTextEl ? successTextEl.textContent : "";

  function openModal(packageId) {
    if (!modal) return;
    lastFocused = document.activeElement;

    if (packageId) {
      var packageInput = form && form.querySelector('input[name="package"][value="' + packageId + '"]');
      if (packageInput) packageInput.checked = true;
    }

    // 成功页再次打开时，回到第一步
    if (currentStep === 3) {
      goToStep(1);
      resetErrors();
    }

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    if (stickyBar) stickyBar.classList.remove("is-visible");

    window.setTimeout(function () {
      focusFirstField();
      if (panel) panel.scrollTop = 0;
    }, 260);

    track("booking_open", { package: packageId || "default" });
  }

  function closeModal() {
    if (!modal || !modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    updateOnScroll();
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus({ preventScroll: true });
    }
  }

  function trapFocus(event) {
    if (event.key !== "Tab" || !modal || !modal.classList.contains("is-open")) return;
    var focusables = $$(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      panel
    ).filter(function (el) {
      return el.offsetParent !== null;
    });
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeModal();
    trapFocus(event);
  });

  $$("[data-open-booking]").forEach(function (trigger) {
    trigger.addEventListener("click", function (event) {
      event.preventDefault();
      openModal(trigger.getAttribute("data-package"));
    });
  });

  $$("[data-close-modal]").forEach(function (trigger) {
    trigger.addEventListener("click", closeModal);
  });

  /* ---------------- 表单步骤 ---------------- */

  function setProgress(step) {
    var bar = $("[data-progress]");
    if (!bar) return;
    bar.style.width = step === 1 ? "50%" : step === 2 ? "100%" : "100%";
  }

  function goToStep(step) {
    currentStep = step;
    $$(".form-step", form).forEach(function (section) {
      var isActive = Number(section.getAttribute("data-step")) === step;
      section.hidden = !isActive;
      section.classList.toggle("is-active", isActive);
    });
    setProgress(step);
    if (modal) {
      modal.setAttribute("aria-labelledby", step === 1 ? "bookingTitle" : step === 2 ? "contactTitle" : "successTitle");
    }
    if (panel) panel.scrollTop = 0;
    window.setTimeout(focusFirstField, 60);
  }

  function focusFirstField() {
    if (!form) return;
    var activeStep = $(".form-step.is-active", form);
    if (!activeStep) return;
    var first = activeStep.querySelector('select, input:not([type=radio]):not([type=hidden]):not([tabindex="-1"]), textarea, button');
    if (first && typeof first.focus === "function") first.focus({ preventScroll: true });
  }

  function resetErrors() {
    $$(".form-error", form).forEach(function (el) {
      el.classList.remove("is-visible");
      el.textContent = "";
    });
    $$(".field.has-error", form).forEach(function (el) {
      el.classList.remove("has-error");
    });
    $$("[aria-invalid]", form).forEach(function (el) {
      el.removeAttribute("aria-invalid");
    });
    $$(".field-error", form).forEach(function (el) {
      el.textContent = "";
    });
  }

  function setFormError(name, message) {
    var el = $('[data-error="' + name + '"]', form);
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-visible");
  }

  function setFieldError(fieldName, message) {
    var input = form.elements[fieldName];
    if (!input) return;
    var field = input.closest(".field");
    var errorEl = $('[data-error-for="' + fieldName + '"]', form);
    if (field) field.classList.add("has-error");
    input.setAttribute("aria-invalid", "true");
    if (errorEl) errorEl.textContent = message;
  }

  function validateStep1() {
    resetErrors();
    var data = new FormData(form);
    var pkg = data.get("package");
    var month = data.get("month");
    var pax = Number(data.get("pax"));
    var riding = data.get("riding");

    if (!pkg) {
      setFormError("step1", "请选择想体验的天数。");
      return false;
    }
    if (!month) {
      setFormError("step1", "请选择大概的出发时间，选“还没定”也可以。");
      return false;
    }
    if (!pax || pax < 1 || pax > 8) {
      setFormError("step1", "每期最多 8 人，请选择 1—8 人。");
      return false;
    }
    if (!riding) {
      setFormError("step1", "请选择你的骑马经验，方便我们提前配马。");
      return false;
    }
    return true;
  }

  function validateStep2() {
    resetErrors();
    var name = String(form.elements.name.value || "").trim();
    var phone = String(form.elements.phone.value || "").trim();
    var consent = form.elements.consent.checked;

    if (name.length < 1) {
      setFieldError("name", "请告诉我们怎么称呼你。");
    } else if (name.length > 30) {
      setFieldError("name", "称呼请控制在 30 个字以内。");
    }

    var digits = phone.replace(/[\s-]/g, "");
    if (!/^(?:\+?86)?1[3-9]\d{9}$/.test(digits)) {
      setFieldError("phone", "请填写 11 位中国大陆手机号。");
    }

    if (!consent) {
      var consentError = $('[data-error-for="consent"]', form);
      if (consentError) consentError.textContent = "请先勾选同意，我们才能联系你。";
    }

    if (name.length < 1 || name.length > 30 || !/^(?:\+?86)?1[3-9]\d{9}$/.test(digits) || !consent) {
      setFormError("step2", "还有一项信息需要补充，检查一下标红的地方。");
      return false;
    }
    return true;
  }

  $$("[data-next-step]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (validateStep1()) {
        goToStep(2);
        track("booking_step2", {});
      }
    });
  });

  $$("[data-prev-step]").forEach(function (button) {
    button.addEventListener("click", function () {
      resetErrors();
      goToStep(1);
    });
  });

  // 第一步按回车也进入下一步，而不是直接提交
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (currentStep === 1) {
        if (validateStep1()) goToStep(2);
        return;
      }
      if (currentStep === 2) submitBooking();
    });
  }

  /* ---------------- 月份选项 ---------------- */

  var monthSelect = $("#monthSelect");
  function buildMonthOptions() {
    if (!monthSelect) return;
    var now = new Date();
    var currentYear = now.getFullYear();
    var currentMonth = now.getMonth();
    var html = '<option value="flexible">还没定，先咨询</option>';

    for (var i = 0; i < 18; i++) {
      var d = new Date(currentYear, currentMonth + i, 1);
      var year = d.getFullYear();
      var month = d.getMonth() + 1;
      var value = year + "-" + String(month).padStart(2, "0");
      var label = year + "年" + month + "月";
      if (i === 0) label = "本月（" + month + "月）";
      if (month >= 5 && month <= 10) label += " · 推荐";
      html += '<option value="' + value + '">' + label + "</option>";
    }
    monthSelect.innerHTML = html;
    monthSelect.value = "flexible";
  }
  buildMonthOptions();

  /* ---------------- 提交 ---------------- */

  function collectPayload() {
    var data = new FormData(form);
    return {
      package: data.get("package"),
      month: data.get("month"),
      pax: Number(data.get("pax")),
      riding: data.get("riding"),
      name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      wechat: String(data.get("wechat") || "").trim(),
      city: String(data.get("city") || "").trim(),
      notes: String(data.get("notes") || "").trim(),
      consent: data.get("consent") === "yes",
      website: String(data.get("website") || ""),
      channel: isWechat ? "wechat" : "web",
      page: window.location.href
    };
  }

  function setSubmitting(state) {
    isSubmitting = state;
    var button = $("[data-submit]", form);
    if (!button) return;
    button.disabled = state;
    button.style.opacity = state ? "0.65" : "";
    button.innerHTML = state ? "正在提交…" : "提交预约 <span>→</span>";
  }

  function makeDemoId() {
    return "AUL-DEMO-" + Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  function saveDemoBooking(payload) {
    var bookingId = makeDemoId();
    try {
      var list = JSON.parse(localStorage.getItem("aul_demo_bookings") || "[]");
      list.push(Object.assign({}, payload, {
        id: bookingId,
        createdAt: new Date().toISOString()
      }));
      localStorage.setItem("aul_demo_bookings", JSON.stringify(list));
    } catch (error) {}
    showSuccess(bookingId, true);
    track("booking_demo", { package: payload.package, pax: payload.pax });
  }

  function submitBooking() {
    if (isSubmitting || !validateStep2()) return;

    var payload = collectPayload();
    if (payload.website) return; // 蜜罐，静默丢弃

    if (CONFIG.demoMode) {
      saveDemoBooking(payload);
      return;
    }

    setSubmitting(true);
    var controller = new AbortController();
    var timeout = window.setTimeout(function () { controller.abort(); }, 15000);

    fetch((CONFIG.apiBase || "") + "/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          if (!response.ok || body.ok === false) {
            throw new Error(body.error || "提交失败，请稍后再试。");
          }
          return body;
        });
      })
      .then(function (body) {
        window.clearTimeout(timeout);
        setSubmitting(false);
        try {
          localStorage.removeItem("aul_booking_draft");
        } catch (error) {}
        showSuccess(body.bookingId || "AUL-PENDING");
        track("booking_submit", { package: payload.package, pax: payload.pax });
      })
      .catch(function (error) {
        window.clearTimeout(timeout);
        setSubmitting(false);
        var message = error && error.name === "AbortError"
          ? "网络有点慢，提交超时了。请重试，或复制报名信息加微信发送。"
          : "提交没有成功。请检查网络后重试，或复制报名信息加微信发送。";
        try {
          localStorage.setItem("aul_booking_draft", JSON.stringify(payload));
        } catch (storageError) {}
        var errorBox = $('[data-error="step2"]', form);
        if (errorBox) {
          errorBox.innerHTML = message + ' <button type="button" class="text-link" data-copy-booking>复制报名信息 →</button>';
          errorBox.classList.add("is-visible");
        }
        track("booking_error", { message: error && error.message ? error.message : "unknown" });
      });
  }

  function showSuccess(bookingId, isDemo) {
    goToStep(3);
    var idEl = $("[data-booking-id]", form);
    if (idEl) idEl.textContent = bookingId;

    if (successTitleEl) {
      successTitleEl.innerHTML = isDemo
        ? "演示报名<br><em>已完成。</em>"
        : successTitleDefault;
    }
    if (successKickerEl) {
      successKickerEl.textContent = isDemo ? "演示报名已生成" : successKickerDefault;
    }
    if (successTextEl) {
      successTextEl.textContent = isDemo
        ? "这是演示环境，信息只保存在当前浏览器，没有发送到云端。请复制报名信息，通过微信发给领队，完成真实预约。"
        : successTextDefault;
    }
    if (demoNoteEl) demoNoteEl.hidden = !isDemo;
    if (demoCopyButton) demoCopyButton.hidden = !isDemo;

    resetErrors();
    if (panel) panel.scrollTop = 0;
    if (successTitleEl) {
      successTitleEl.setAttribute("tabindex", "-1");
      successTitleEl.focus({ preventScroll: true });
    }
    track(isDemo ? "booking_demo_success" : "booking_success", { bookingId: bookingId });
  }

  /* ---------------- 复制信息 / 微信 / 分享 ---------------- */

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () {
        return fallbackCopy(text);
      });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    area.style.top = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, area.value.length);
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  function showToast(message) {
    var toast = $("#toast");
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2800);
  }

  function bookingSummary() {
    var pkgNames = { "3d": "3天2晚 初识牧场", "5d": "5天4晚 牧人日常", "7d": "7天6晚 跟着羊群走", long: "14天以上 定制" };
    var ridingNames = { zero: "零基础", some: "骑过几次", good: "比较熟练" };
    if (!form) return "";
    var data = collectPayload();
    return [
      "【阿吾勒 · 报名】",
      "称呼：" + (data.name || "未填"),
      "手机：" + (data.phone || "未填"),
      "微信：" + (data.wechat || "未填"),
      "城市：" + (data.city || "未填"),
      "套餐：" + (pkgNames[data.package] || data.package),
      "时间：" + (data.month === "flexible" ? "还没定，先咨询" : data.month),
      "人数：" + data.pax + " 人",
      "骑马经验：" + (ridingNames[data.riding] || data.riding),
      "备注：" + (data.notes || "无")
    ].join("\n");
  }

  $$("[data-copy-wechat]").forEach(function (button) {
    button.addEventListener("click", function () {
      copyText(CONFIG.wechat).then(function () {
        showToast("微信号已复制：" + CONFIG.wechat + "，去微信添加时备注“伊犁”");
      });
    });
  });

  document.addEventListener("click", function (event) {
    var copyBookingButton = event.target.closest("[data-copy-booking]");
    if (copyBookingButton) {
      event.preventDefault();
      copyText(bookingSummary()).then(function () {
        showToast("报名信息已复制，去微信发给领队吧");
      });
    }
  });

  $$("[data-share]").forEach(function (button) {
    button.addEventListener("click", function () {
      var shareData = {
        title: CONFIG.share.title,
        text: CONFIG.share.text,
        url: CONFIG.share.url || window.location.href
      };
      var shareText = shareData.title + "\n" + shareData.text + "\n" + shareData.url;
      if (navigator.share && !isWechat) {
        navigator.share(shareData).catch(function (error) {
          if (error && error.name === "AbortError") return;
          copyText(shareText).then(function () {
            showToast("分享文案已复制，去微信群粘贴吧");
          });
        });
      } else {
        copyText(shareText).then(function () {
          showToast("分享文案已复制，去微信群粘贴吧");
        });
      }
      track("share_click", {});
    });
  });

  /* ---------------- 轻量埋点 ---------------- */

  function track(name, data) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: name }, data || {}));
    if (typeof window.aulTrack === "function") {
      try { window.aulTrack(name, data || {}); } catch (error) {}
    }
  }

  // 记录页面来源，方便判断微信群/朋友圈效果
  track("page_view", { channel: isWechat ? "wechat" : "web" });
})();
