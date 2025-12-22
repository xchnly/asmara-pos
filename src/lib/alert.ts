import Swal from "sweetalert2";

export const successAlert = (msg: string) =>
  Swal.fire({
    icon: "success",
    title: "Berhasil",
    text: msg,
    timer: 1500,
    showConfirmButton: false,
  });

export const errorAlert = (msg: string) =>
  Swal.fire({
    icon: "error",
    title: "Gagal",
    text: msg,
  });

export const confirmAlert = async (msg: string) => {
  const result = await Swal.fire({
    title: "Yakin?",
    text: msg,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#10b981", // hijau
    cancelButtonText: "Batal",
    confirmButtonText: "Ya",
  });
  return result.isConfirmed;
};
