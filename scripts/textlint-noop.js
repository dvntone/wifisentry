module.exports = function textlintNoop(context) {
  return {
    [context.Syntax.Document]() {}
  };
};
