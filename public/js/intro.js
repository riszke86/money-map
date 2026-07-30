document.addEventListener("DOMContentLoaded", () => {
    const introScreen = document.getElementById("introScreen");

    // Reveal the properly styled page once the DOM is ready
    document.body.classList.remove("loading");

    if (!introScreen) {
        return;
    }

    const introAlreadyPlayed =
        sessionStorage.getItem("moneyMapIntroPlayed");

    if (introAlreadyPlayed === "true") {
        introScreen.remove();
        document.body.classList.remove("intro-active");
        return;
    }

    document.body.classList.add("intro-active");

    window.setTimeout(() => {
        introScreen.classList.add("intro-hidden");
        document.body.classList.remove("intro-active");

        sessionStorage.setItem(
            "moneyMapIntroPlayed",
            "true"
        );
    }, 2100);

    window.setTimeout(() => {
        introScreen.remove();
    }, 2900);
});