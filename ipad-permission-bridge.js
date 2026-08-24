(() => {
  "use strict";
  // DPRO MEDICAL BRUSHUP-8 IPAD CHECK-IN PERMISSION BRIDGE V1.0
  const api=window.DPROMedicalClinicApi;
  if(!api||typeof api.hasPermission!=="function") throw new Error("DPROMedicalClinicApi.hasPermission is required.");
  const base=api.hasPermission.bind(api);
  api.hasPermission=function(context,permission){
    if(permission==="appointment.check_in") return base(context,"visit.write");
    return base(context,permission);
  };
})();
